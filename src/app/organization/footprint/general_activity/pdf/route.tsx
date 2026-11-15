/*
 * API สร้าง PDF สรุปผลกิจกรรมทั่วไป (TOR ข้อ 9.3)
 *   - รับตัวเลขที่คำนวณและแสดงอยู่แล้วจาก CalculationResult.tsx (POST แบบ JSON) แล้วคืนไฟล์ PDF
 *   - ไม่อ่าน/เขียนฐานข้อมูล จึงไม่คำนวณใหม่ (ตัวเลขใน PDF = ตัวเลขที่ผู้ใช้เห็นบนหน้าจอ)
 *   - ใช้ไลบรารี @react-pdf/renderer และโหลดฟอนต์ Sarabun (ภาษาไทย) จาก CDN
 */
import { NextResponse } from 'next/server';
import { ELECTRICITY_PRICE_BAHT_PER_KWH, vehicleLabel } from '../calculation';
import React from 'react';
import {
  renderToBuffer,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

export const runtime = 'nodejs';

Font.register({
  family: 'Sarabun',
  src: 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/sarabun/Sarabun-Regular.ttf',
});

// รูปแบบข้อมูลที่รับเข้ามา (ทุกช่องเป็น optional เพราะมาจาก JSON ที่ไม่ได้ผ่านการตรวจชนิดข้อมูล)
interface FuelOptionItem {
  option?: { name?: string };
  emissionTon?: number;
  reductionTon?: number;
  electricityReductionKWh?: number;
  electricityCostSaved?: number;
  isCurrent?: boolean;
}

interface GroupedRecommendation {
  category_type?: string;
  bestEmissionTon?: number;
  fuels?: FuelOptionItem[];
}

// แสดงตัวเลขแบบไทย ทศนิยมคงที่ (ค่าที่ไม่ใช่ตัวเลขหรือติดลบถือเป็น 0)
const formatNum = (num: number = 0, decimals = 4): string => {
  const safeNum = typeof num === 'number' && !isNaN(num) ? Math.max(0, num) : 0;
  return safeNum.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// มีข้อเสนอแนะอย่างน้อย 1 ตัวเลือกที่ไม่ใช่แบบที่ใช้อยู่หรือไม่ (ถ้าไม่มีจะไม่พิมพ์ส่วนข้อเสนอแนะ)
const hasValidRecs = (recs?: GroupedRecommendation[]): boolean =>
  Array.isArray(recs) &&
  recs.some((g) => Array.isArray(g.fuels) && g.fuels.some((f) => !f.isCurrent));

const styles = StyleSheet.create({
  page: {
    paddingVertical: 20,
    paddingHorizontal: 24,
    fontFamily: 'Sarabun',
    fontSize: 9,
    color: '#1f2937',
  },
  header: {
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
    color: '#111827',
  },
  summaryContainer: {
    marginBottom: 8,
  },
  card: {
    marginBottom: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 5,
    backgroundColor: '#ffffff',
  },
  cardTitle: {
    fontSize: 10,
    marginBottom: 1,
    color: '#111827',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subText: {
    fontSize: 7.5,
    color: '#6b7280',
    marginTop: 1,
  },
  totalCard: {
    marginTop: 2,
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalText: {
    fontSize: 11,
    color: '#065f46',
  },
  recSection: {
    marginTop: 8,
  },
  recHeaderBlock: {
    paddingLeft: 8,
    paddingVertical: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#32885F',
    marginBottom: 8,
  },
  recHeader: {
    fontSize: 11.5,
    color: '#111827',
  },
  recSubHeader: {
    fontSize: 7.5,
    color: '#6b7280',
    marginTop: 1,
  },
  catTitle: {
    fontSize: 9.5,
    color: '#111827',
    marginTop: 6,
    marginBottom: 4,
  },
  groupCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 5,
    padding: 6,
    marginBottom: 6,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 3,
  },
  groupTitle: {
    fontSize: 8.5,
    color: '#374151',
  },
  bestEmissionText: {
    fontSize: 7.5,
    color: '#047857',
  },
  fuelCard: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 4,
    padding: 5,
    marginBottom: 3,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fuelInfoLeft: {
    flexDirection: 'column',
    flexShrink: 1,
  },
  fuelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fuelName: {
    fontSize: 8.5,
    color: '#111827',
    marginRight: 6,
    flexShrink: 1, // ป้องกันชื่อยาวบีบกล่อง Badge
  },
  badge: {
    backgroundColor: '#32885F',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    alignSelf: 'center',
    flexShrink: 0, // ห้ามบีบกล่อง Badge
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 7,
    paddingRight: 4, // ระยะเผื่อ Bounding Box ของฟอนต์ Sarabun
  },
  elecSubText: {
    fontSize: 7,
    color: '#047857',
    marginTop: 1,
  },
  rightStatBox: {
    textAlign: 'right',
    flexShrink: 0,
    marginLeft: 8,
  },
  emissionVal: {
    fontSize: 9,
    color: '#111827',
  },
  reductionVal: {
    fontSize: 7.5,
    color: '#059669',
    marginTop: 1,
  },
});

const RecCategoryList = ({
  title,
  recommendations,
  labelPrefix,
}: {
  title: string;
  recommendations: GroupedRecommendation[];
  labelPrefix: string;
}) => {
  if (!hasValidRecs(recommendations)) return null;

  return (
    <View>
      <Text style={styles.catTitle}>{title}</Text>
      {recommendations.map((group, gIdx) => {
        const validFuels = (group.fuels || []).filter((f) => !f.isCurrent);
        if (validFuels.length === 0) return null;

        return (
          <View key={gIdx} style={styles.groupCard} wrap={false}>
            <View style={styles.groupHeaderRow}>
              <Text style={styles.groupTitle}>
                {`${labelPrefix}: ${vehicleLabel(group.category_type)}`}
              </Text>
              <Text style={styles.bestEmissionText}>
                {`ปล่อยน้อยที่สุดในกลุ่ม: ${formatNum(group.bestEmissionTon)} tCO2e`}
              </Text>
            </View>

            {validFuels.map((fuel, fIdx) => {
              const hasElecSaved =
                (fuel.electricityReductionKWh || 0) > 0 ||
                (fuel.electricityCostSaved || 0) > 0;

              return (
                <View key={fIdx} style={styles.fuelCard}>
                  <View style={styles.fuelInfoLeft}>
                    <View style={styles.fuelTitleRow}>
                      <Text style={styles.fuelName}>
                        {fuel.option?.name ?? ''}
                      </Text>
                      {fIdx === 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText} wrap={false}>
                            แนะนำที่สุด{'\u00A0'}
                          </Text>
                        </View>
                      )}
                    </View>
                    {hasElecSaved && (
                      <Text style={styles.elecSubText}>
                        {`ไฟฟ้าลดลง: ${formatNum(fuel.electricityReductionKWh, 2)} kWh | ประหยัดค่าไฟโดยประมาณ: ${formatNum(fuel.electricityCostSaved, 2)} บาท`}
                      </Text>
                    )}
                  </View>

                  <View style={styles.rightStatBox}>
                    <Text style={styles.emissionVal}>
                      {`${formatNum(fuel.emissionTon)} tCO2e`}
                    </Text>
                    {(fuel.reductionTon || 0) > 0 && (
                      <Text style={styles.reductionVal}>
                        {`ลดลง ${formatNum(fuel.reductionTon)} tCO2e`}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
};

// รับข้อมูลผลคำนวณแล้วสร้าง PDF ส่งกลับเป็นไฟล์ดาวน์โหลด
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const meetingEmission = Number(body.meetingEmission) || 0;
    const travelEmission = Number(body.travelEmission) || 0;
    const totalEmission = meetingEmission + travelEmission;

    const meetingElecKWh = Number(body.meetingRawElectricityKWh) || 0;
    const meetingElecCost = Number(body.meetingElectricityCost) || 0;
    const travelElecKWh = Number(body.travelRawElectricityKWh) || 0;
    const travelElecCost = Number(body.travelElectricityCost) || 0;

    const meetingRecommendation: GroupedRecommendation[] =
      body.meetingRecommendation || [];
    const travelRecommendation: GroupedRecommendation[] =
      body.travelRecommendation || [];

    const hasAnyRec =
      hasValidRecs(meetingRecommendation) ||
      hasValidRecs(travelRecommendation);

    const PdfDocument = (
      <Document>
        <Page size="A4" style={styles.page}>
          <Text style={styles.header}>
            สรุปผลการประเมินคาร์บอนฟุตพรินต์องค์กร
          </Text>

          {/* สรุปผลการคำนวณหลัก */}
          <View style={styles.summaryContainer} wrap={false}>
            <View style={styles.card}>
              <View style={styles.row}>
                <View>
                  <Text style={styles.cardTitle}>
                    หมวดการประชุม อบรม และจัดอีเวนต์
                  </Text>
                  {meetingElecKWh > 0 && (
                    <Text style={styles.subText}>
                      {`ปริมาณไฟฟ้า: ${formatNum(meetingElecKWh, 2)} kWh | ค่าไฟโดยประมาณ (${ELECTRICITY_PRICE_BAHT_PER_KWH} บาท/kWh): ${formatNum(meetingElecCost, 2)} บาท`}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 11 }}>
                  {`${formatNum(meetingEmission)} tCO2e`}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.row}>
                <View>
                  <Text style={styles.cardTitle}>
                    หมวดการเดินทาง
                  </Text>
                  {travelElecKWh > 0 && (
                    <Text style={styles.subText}>
                      {`ปริมาณไฟฟ้า: ${formatNum(travelElecKWh, 2)} kWh | ค่าไฟโดยประมาณ (${ELECTRICITY_PRICE_BAHT_PER_KWH} บาท/kWh): ${formatNum(travelElecCost, 2)} บาท`}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: 11 }}>
                  {`${formatNum(travelEmission)} tCO2e`}
                </Text>
              </View>
            </View>

            <View style={styles.totalCard}>
              <Text style={styles.totalText}>
                ปริมาณการปล่อยก๊าซเรือนกระจกรวมทั้งหมด
              </Text>
              <Text style={styles.totalText}>
                {`${formatNum(totalEmission)} tCO2e`}
              </Text>
            </View>
          </View>

          {/* หมวดข้อเสนอแนะ */}
          {hasAnyRec && (
            <View style={styles.recSection}>
              <View style={styles.recHeaderBlock} wrap={false}>
                <Text style={styles.recHeader}>
                  ข้อเสนอแนะเพื่อการลดการปล่อยก๊าซเรือนกระจก
                </Text>
                <Text style={styles.recSubHeader}>
                  แนวทางและเปรียบเทียบทางเลือกในการลดปริมาณการปล่อยคาร์บอนขององค์กร
                </Text>
              </View>

              <RecCategoryList
                title="• หมวดการประชุม อบรม และจัดกิจกรรม"
                recommendations={meetingRecommendation}
                labelPrefix="รูปแบบ"
              />

              <RecCategoryList
                title="• หมวดการเดินทาง"
                recommendations={travelRecommendation}
                labelPrefix="พาหนะ"
              />
            </View>
          )}
        </Page>
      </Document>
    );

    const pdfBuffer = await renderToBuffer(PdfDocument);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="General_Activity_Report_${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF Generation Server Error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'เกิดข้อผิดพลาดในการสร้างไฟล์ PDF',
      },
      { status: 500 }
    );
  }
}