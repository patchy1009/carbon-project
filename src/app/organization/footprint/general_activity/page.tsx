"use client";

/*
 * หน้า "กิจกรรมทั่วไป" (TOR ข้อ 9) = ขั้นที่ 3 ของการบันทึกคาร์บอนฟุตพรินต์
 * องค์กรกรอกข้อมูล "การประชุม/อบรม/อีเวนต์" และ "การเดินทาง" แล้วระบบคำนวณปริมาณก๊าซเรือนกระจก
 * แนะนำวิธีลดคาร์บอน และให้ดาวน์โหลดสรุปเป็น PDF
 *
 * ลำดับการทำงานของหน้านี้
 *   1) โหลดค่า EF (emission_factor) และรหัสองค์กรของผู้ที่ล็อกอิน
 *   2) ฟอร์มประชุม (MeetingForm) / ฟอร์มเดินทาง (TravelForm) ส่งข้อมูลที่กรอกขึ้นมาเก็บไว้ในหน้านี้
 *   3) กดปุ่ม "คำนวณและบันทึก" -> handleCalculateAndSave
 *        ตรวจข้อมูล (syntax / ช่วงตัวเลข / มีค่า EF ครบ) -> คำนวณ + สร้างคำแนะนำ (calculation.ts)
 *        -> บันทึกลงตาราง general_activity_meeting / general_activity_traveling
 *   4) แสดงผลด้วย CalculationResult (มีปุ่มดาวน์โหลด PDF ที่ ./pdf/route.tsx)
 *
 * ข้อควรรู้
 *   - ข้อมูลที่บันทึกที่นี่ยังไม่ผูกกับรายการดำเนินงาน (org_activity_list) จึงไม่รวมในรายงานและแดชบอร์ดของข้อ 8
 *   - ตาราง general_activity_* ต้องเปิด RLS (supabase/rls_general_activity.sql) ไม่งั้นองค์กรเห็นข้อมูลกันเอง
 */

import React, { useState, useEffect } from "react";
import MeetingForm, { MeetingData } from "./MeetingForm";
import TravelForm, { TravelData } from "./TravelForm";
import CalculationResult from "./CalculationResult";
import {
  calculateMeetingSummary,
  calculateTravelSummary,
  getTravelRecommendations,
  getMeetingRecommendations,
  VEHICLE_FUEL_MAPPINGS,
  EV_KWH_PER_KM,
  fuelLabel,
  GroupedVehicleRecommendation,
  OptionType
} from "./calculation";
import FootprintStepper from "@/components/FootprintStepper";
import { supabase } from "@/lib/supabaseClient";
import { containsSqlSyntax } from "@/lib/sqlSyntax"; // ตรวจ Syntax ป้องกัน SQL Injection (TOR 9.4)
import { getErrorMessage } from "@/lib/errorMessage";
import { Calculator } from "lucide-react";
import { useRouter } from "next/navigation";

// แถวของตาราง emission_factor ที่หน้านี้ใช้ (join ชนิด EF มาด้วยในชื่อ eftype)
type EfRow = {
  ef_id?: string | null;
  id?: string | null;
  ef_name?: string | null;
  ef_value?: number | string | null;
  fuel_type?: string | null;
  eftype?: { type_name?: string | null } | null;
};

// ชื่อที่ใช้บอกผู้ใช้เมื่อไม่พบค่า EF ของเชื้อเพลิงนั้นในระบบ
const EF_LABELS: Record<string, string> = {
  electricity: "ไฟฟ้า (Grid Mix)", gasohol_e10: "แก๊สโซฮอล์ E10", gasohol_e20: "แก๊สโซฮอล์ E20", gasohol_e85: "แก๊สโซฮอล์ E85",
  diesel_b7: "ดีเซล B7", diesel_b20: "ดีเซล B20", cng: "CNG", lpg: "LPG",
};

export default function ActivityBasedFootprintPage() {
  const [orgId, setOrgId] = useState<string | null>(null);
  const router = useRouter();

  // ปุ่ม "‹ กลับ": กลับไปขั้นที่ 2 (ถ้ามาจากรายการที่แก้อยู่ ?edit= ให้กลับไปรายการนั้น)
  const goBack = () => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    // มาจากปุ่มในหน้ารายงาน (&from=report) -> กลับไปหน้ารายงานเดิม
    if (editId && params.get("from") === "report") {
      router.push(`/organization/footprint/report?id=${encodeURIComponent(editId)}`);
      return;
    }
    router.push(editId ? `/organization/footprint/activity?edit=${encodeURIComponent(editId)}` : "/organization/footprint/activity");
  };

  const [emissionFactorsList, setEmissionFactorsList] = useState<EfRow[]>([]);
  const [loadingSystem, setLoadingSystem] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasCalculated, setHasCalculated] = useState(false);

  // ข้อมูลที่ฟอร์มส่งขึ้นมา (null = ยังไม่ได้กรอก)
  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [travelingData, setTravelingData] = useState<TravelData | null>(null);

  // ผลคำนวณของการประชุม
  const [meetingEmissionTon, setMeetingEmissionTon] = useState<number>(0);
  const [meetingRawElectricityKWh, setMeetingRawElectricityKWh] = useState<number>(0);
  const [meetingElectricityCost, setMeetingElectricityCost] = useState<number>(0);
  const [meetingRecommendation, setMeetingRecommendation] = useState<GroupedVehicleRecommendation[]>([]);

  // ผลคำนวณของการเดินทาง
  const [travelingEmissionTon, setTravelingEmissionTon] = useState<number>(0);
  const [travelingRawElectricityKWh, setTravelingRawElectricityKWh] = useState<number>(0);
  const [travelingElectricityCost, setTravelingElectricityCost] = useState<number>(0);
  const [travelingRecommendation, setTravelingRecommendation] = useState<GroupedVehicleRecommendation[]>([]);

  // โหลดรหัสองค์กร (= id ของผู้ที่ล็อกอิน) และค่า EF ทั้งตาราง
  useEffect(() => {
    async function initSystem() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          alert("กรุณาเข้าสู่ระบบก่อนใช้งานระบบประเมินคาร์บอนฟุตพรินต์");
          return;
        }
        setOrgId(user.id);

        const { data: efData } = await supabase
          .from('emission_factor')
          .select('*, eftype:eftype_id (type_name)');

        if (efData) setEmissionFactorsList(efData);
      } catch (err) {
        console.error("System init error:", err);
      } finally {
        setLoadingSystem(false);
      }
    }
    initSystem();
  }, []);

  /* ---------- หาค่า EF จากตาราง emission_factor ---------- */

  // ในตารางมีค่า EF ไฟฟ้าหลายชุด (เช่น grid mix ปี 2016-2018 = 0.4999 และปี 2022-2024 = 0.475)
  // เดิมใช้ .find() ได้แถวแรกที่เจอ ซึ่งขึ้นกับลำดับแถวจากฐานข้อมูล อาจได้ค่าเก่า
  // จึงเลือกแถวที่ชื่อมี "ปี ค.ศ." มากที่สุด (ชุดข้อมูลใหม่ล่าสุด) ถ้าชื่อไม่มีปีเลยจะใช้แถวแรกเหมือนเดิม
  const latestYearInName = (name: string | null | undefined) => {
    const years = (name || '').match(/(?<!\d)(?:19|20)\d{2}(?!\d)/g) ?? [];
    return years.length ? Math.max(...years.map(Number)) : 0;
  };
  const pickLatestEF = (rows: EfRow[]): EfRow | undefined =>
    rows.reduce<EfRow | undefined>(
      (best, row) => (!best || latestYearInName(row.ef_name) > latestYearInName(best.ef_name) ? row : best),
      undefined
    );

  // ค่า EF ของไฟฟ้า (หาจากชื่อที่มีคำว่า grid/ไฟฟ้า หรือชนิด electricity) เลือกชุดข้อมูลปีล่าสุด
  // found = false หมายถึงไม่พบในตาราง: หน้านี้จะไม่คำนวณ (ค่า 0.4999 ที่ส่งกลับเป็นแค่ค่ากันพัง ไม่ได้ถูกใช้คำนวณจริง)
  const fetchElectricityEFFromDB = () => {
    const matchedItem = pickLatestEF(
      emissionFactorsList.filter((ef) => {
        const efName = (ef.ef_name || '').toLowerCase();
        const efType = (ef.eftype?.type_name || '').toLowerCase();
        return efName.includes('grid') || efName.includes('ไฟฟ้า') || efType.includes('electricity');
      })
    );

    const value = matchedItem ? Number(matchedItem.ef_value) : 0;
    return {
      id: matchedItem ? (matchedItem.ef_id || matchedItem.id || null) : null,
      value: value > 0 ? value : 0.4999,
      found: value > 0,
    };
  };

  // ค่า EF ของเชื้อเพลิงตามรหัส (เช่น 'diesel_b7' -> หาแถวที่มีคำว่า "diesel b7")
  // รหัส electricity/ev/online ใช้ค่าไฟฟ้า (grid) ถ้าไม่พบ found = false เหมือนข้างบน
  const getEFDetail = (fuelKey: string) => {
    if (!fuelKey) return { id: null, value: 0.5, found: false };
    const lowerKey = fuelKey.toLowerCase().trim();
    let targetKeyword = lowerKey;
    if (lowerKey === 'electricity' || lowerKey === 'ev' || lowerKey === 'online') {
      targetKeyword = 'grid';
    } else if (lowerKey.includes('gasohol_e10')) targetKeyword = 'gasohol e10';
    else if (lowerKey.includes('gasohol_e20')) targetKeyword = 'gasohol e20';
    else if (lowerKey.includes('gasohol_e85')) targetKeyword = 'gasohol e85';
    else if (lowerKey.includes('diesel_b7')) targetKeyword = 'diesel b7';
    else if (lowerKey.includes('diesel_b20')) targetKeyword = 'diesel b20';
    else if (lowerKey.includes('lpg')) targetKeyword = 'lpg';
    else if (lowerKey.includes('cng')) targetKeyword = 'cng';

    const candidates = emissionFactorsList.filter((ef) => {
      const efName = (ef.ef_name || '').toLowerCase();
      const efType = (ef.eftype?.type_name || '').toLowerCase();
      const efFuelType = (ef.fuel_type || '').toLowerCase();
      return efName.includes(targetKeyword) || efType.includes(targetKeyword) || efFuelType.includes(targetKeyword);
    });
    // ไฟฟ้า (grid) มีหลายปี เลือกปีล่าสุด ส่วนเชื้อเพลิงอื่นใช้แถวแรกเหมือนเดิม
    const matchedItem = targetKeyword === 'grid' ? pickLatestEF(candidates) : candidates[0];

    const value = matchedItem ? Number(matchedItem.ef_value) : 0;
    return {
      id: matchedItem ? (matchedItem.ef_id || matchedItem.id || null) : null,
      value: value > 0 ? value : 0.5,
      found: value > 0,
    };
  };

  // ใช้ในส่วนคำแนะนำ: ไม่พบค่า EF -> ส่ง NaN เพื่อให้ตัวเลือกนั้นถูกข้าม (ไม่แนะนำด้วยค่ากันพัง)
  const getEFValueOrNaN = (fuelKey: string) => {
    const d = getEFDetail(fuelKey);
    return d.found ? d.value : NaN;
  };

  /* ---------- ตรวจข้อมูลก่อนคำนวณ ---------- */

  // คืนข้อความเตือนของข้อแรกที่ไม่ผ่าน หรือ null ถ้าผ่านทั้งหมด (ถ้าไม่ผ่านจะไม่ลบ ไม่บันทึก ไม่ส่งอะไรไปฐานข้อมูล)
  const validateInputs = (): string | null => {
    if (!orgId) return "ไม่พบข้อมูลรหัสองค์กร กรุณาเข้าสู่ระบบใหม่";

    if (!meetingData && !travelingData) {
      return "กรุณากรอกข้อมูลการประชุม หรือข้อมูลการเดินทางอย่างน้อย 1 หมวดก่อนคำนวณ";
    }

    // (1) [TOR 9.4] ช่องข้อความต้องไม่มี Syntax คล้ายคำสั่ง SQL (ชื่อกิจกรรม / ชื่ออุปกรณ์ / ชื่อการเดินทาง)
    const textsToCheck: Array<[string, string]> = [];
    if (meetingData) {
      textsToCheck.push(["ชื่อการประชุม / กิจกรรม", meetingData.meetingName ?? ""]);
      (meetingData.equipmentSets ?? []).forEach((s, i) =>
        textsToCheck.push([`ชนิดอุปกรณ์ ${i + 1}`, s.equipmentName ?? ""])
      );
    }
    if (travelingData) {
      textsToCheck.push(["ชื่อการเดินทาง / ภารกิจ", travelingData.travel_name ?? ""]);
    }
    const badField = textsToCheck.find(([, value]) => containsSqlSyntax(value));
    if (badField) {
      return `${badField[0]} มีรูปแบบที่ไม่อนุญาต (คล้ายคำสั่ง SQL) กรุณากรอกใหม่`;
    }

    // (2) อัตราสิ้นเปลืองไฟฟ้าของ EV ต้องอยู่ในช่วงที่เป็นไปได้ กันกรอกผิดหน่วย
    //     (เช่น กรอก 0.165 ซึ่งเป็นค่าต่อ 1 กม. ลงในช่อง kWh ต่อ 100 กม.)
    //     electricityKwh ในโค้ดเป็น kWh ต่อ กม. (ฟอร์มหาร 100 มาแล้ว) 0.03 – 0.5 = 3 – 50 kWh ต่อ 100 กม.
    const evRates: Array<[string, number | undefined]> = [];
    if (meetingData && meetingData.category_type === "onsite" && meetingData.vehicleType === "ev") {
      evRates.push(["การประชุมออนไซต์", meetingData.electricityKwh]);
    }
    if (travelingData && travelingData.vehicleType.toLowerCase() === "ev") {
      evRates.push(["การเดินทาง", travelingData.electricityKwh]);
    }
    const badEv = evRates.find(([, r]) => r !== undefined && (r < 0.03 || r > 0.5));
    if (badEv) {
      return `${badEv[0]}: อัตราสิ้นเปลืองไฟฟ้าของรถ EV ต้องอยู่ระหว่าง 3 – 50 kWh ต่อ 100 กม. (รถยนต์ไฟฟ้าทั่วไปประมาณ 15 – 22) กรุณาตรวจว่ากรอกเป็นหน่วย kWh ต่อ 100 กม. (เช่น 16.5 ไม่ใช่ 0.165)`;
    }

    // (3) กำลังไฟของอุปกรณ์ต้องไม่เกิน 50 kWh ต่อชั่วโมง (= 50,000 วัตต์) กันกรอกผิดหน่วย
    const badSet = (meetingData?.equipmentSets ?? []).findIndex((s) => s.electricityKwh > 50);
    if (badSet >= 0) {
      return `ชนิดอุปกรณ์ ${badSet + 1}: กำลังไฟสูงเกินไป (ไม่เกิน 50,000 วัตต์) กรุณาตรวจว่ากรอกเป็นหน่วยวัตต์`;
    }

    // (4) ต้องมีค่า EF ที่ใช้คำนวณครบในระบบ ถ้าไม่มีให้บอกผู้ใช้แล้วหยุด (ไม่แอบใช้ค่าสำรอง ผลจะผิดโดยไม่มีใครรู้)
    const neededEf = new Set<string>();
    if (meetingData) {
      neededEf.add("electricity"); // ประชุมทุกแบบมีค่าไฟของอุปกรณ์
      if (meetingData.category_type === "onsite" && meetingData.vehicleType !== "ev") {
        neededEf.add((meetingData.fuelType || "gasohol_e10").toLowerCase());
      }
    }
    if (travelingData) {
      neededEf.add(travelingData.vehicleType.toLowerCase() === "ev" ? "electricity" : (travelingData.fuelType || "gasohol_e10").toLowerCase());
    }
    const missingEf = [...neededEf].filter((k) => !(k === "electricity" ? fetchElectricityEFFromDB() : getEFDetail(k)).found);
    if (missingEf.length > 0) {
      return `ยังไม่พบค่าการปล่อย (EF) ของ ${missingEf.map((k) => EF_LABELS[k] ?? k).join(", ")} ในระบบ จึงยังคำนวณไม่ได้ กรุณาแจ้งผู้ดูแลระบบให้เพิ่มค่า EF ของรายการนี้`;
    }

    return null;
  };

  /* ---------- กดปุ่ม "คำนวณและบันทึก" ---------- */

  const handleCalculateAndSave = async () => {
    const problem = validateInputs();
    if (problem) {
      alert(problem);
      return;
    }

    setIsSaving(true);

    // ล้างผลรอบก่อน กันตัวเลขของหมวดที่ผู้ใช้เอาออกแล้วค้างอยู่ในผลรวม
    setMeetingEmissionTon(0);
    setMeetingRawElectricityKWh(0);
    setMeetingElectricityCost(0);
    setMeetingRecommendation([]);
    setTravelingEmissionTon(0);
    setTravelingRawElectricityKWh(0);
    setTravelingElectricityCost(0);
    setTravelingRecommendation([]);

    try {
      const electricityEfObj = fetchElectricityEFFromDB();

      // ----- 1. การประชุม / อบรม / อีเวนต์ -----
      if (meetingData) {
        const isOnline = meetingData.category_type === 'online';
        // ประชุมออนไลน์ และประชุมออนไซต์ที่ไปด้วย EV ใช้ EF ของไฟฟ้า (ฟอร์มส่ง fuelType = 'electricity' มาให้แล้ว)
        const rawFuel = isOnline ? 'electricity' : (meetingData.fuelType || 'gasohol_e10');
        const meetingEfObj = isOnline ? electricityEfObj : getEFDetail(rawFuel);

        const calcInput = {
          category: 'meeting' as const,
          category_type: meetingData.category_type,
          vehicleType: meetingData.vehicleType,        // ชนิดรถ ใช้เลือกอัตราสิ้นเปลืองของส่วนเดินทางในประชุมออนไซต์
          electricityKWh: meetingData.electricityKwh,  // kWh/กม. ของ EV ที่องค์กรกรอก
          fuelType: rawFuel.toLowerCase(),
          distance: meetingData.distanceKm,
          trip: meetingData.trips,
          durationHours: meetingData.durationHours,
          equipmentSets: meetingData.equipmentSets,
          emissionFactor: meetingEfObj.value,
          electricityEmissionFactor: electricityEfObj.value,
          efId: meetingEfObj.id,
        };

        const summary = calculateMeetingSummary(calcInput);
        setMeetingEmissionTon(summary.totalCalculatedTon);
        setMeetingRawElectricityKWh(summary.rawElectricityKWh);
        setMeetingElectricityCost(summary.electricityCost);

        // ตัวเลือกที่ให้เทียบในคำแนะนำของการประชุม
        const meetingOptions: OptionType[] = [
          { category_type: 'online', fuelType: 'electricity', name: 'การประชุมออนไลน์ (Online)' },
          { category_type: 'ev', fuelType: 'electricity', name: 'ประชุมออนไซต์ รถไฟฟ้า EV' },
          { category_type: 'car', fuelType: 'gasohol_e20', name: 'ประชุมออนไซต์ รถยนต์ (Gasohol E20)' },
          { category_type: 'motorcycle', fuelType: 'gasohol_e10', name: 'ประชุมออนไซต์ รถจักรยานยนต์' },
        ];

        setMeetingRecommendation(getMeetingRecommendations({
          currentEmission: summary.totalCalculatedTon,
          userInput: calcInput,
          allAvailableOptions: meetingOptions,
          fetchEFFromDB: getEFValueOrNaN,
          fetchElectricityEFFromDB: () => electricityEfObj.value,
        }));

        const activityName = meetingData.meetingName || 'การประชุม';

        // ลบข้อมูลเก่าที่ชื่อกิจกรรมเดียวกันก่อน (ทำให้บันทึกซ้ำชื่อเดิม = แก้ไขข้อมูลเดิม)
        await supabase
          .from("general_activity_meeting")
          .delete()
          .eq("org_id", orgId)
          .eq("activity_name", activityName);

        // บันทึกใหม่ 1 แถวต่ออุปกรณ์ 1 ชุด (ฟอร์มตอนเลือกกิจกรรมเก่าจะอ่านทุกแถวที่ชื่อเดียวกันกลับมาเป็นอุปกรณ์หลายชุด)
        // ข้อมูลส่วนอื่น (ชนิดรถ ระยะทาง) ซ้ำกันทุกแถว  electricity_kwh = กำลังไฟของอุปกรณ์ชุดนั้น (kWh ต่อชั่วโมง)
        const equipmentSetsToSave = meetingData.equipmentSets && meetingData.equipmentSets.length > 0
          ? meetingData.equipmentSets
          : [null];
        const meetingRows = equipmentSetsToSave.map((set) => ({
          org_id: orgId,
          activity_name: activityName,
          category_type: meetingData.category_type,
          hours: set?.durationHours || meetingData.durationHours || 1,
          devices: set?.devices || 1,
          equipment_name: set?.equipmentName || 'อุปกรณ์การประชุม',
          vehicle_type: isOnline ? null : (meetingData.vehicleType || null),
          fuel_type: isOnline ? null : rawFuel,
          ef_id: meetingEfObj.id,
          distance: isOnline ? 0 : (meetingData.distanceKm || 0),
          trips: isOnline ? 0 : (meetingData.trips || 1),
          electricity_kwh: set?.electricityKwh || 0,
        }));

        const { error } = await supabase.from("general_activity_meeting").insert(meetingRows);

        if (error) throw error;
      }

      // ----- 2. การเดินทาง -----
      if (travelingData) {
        const isEv = travelingData.vehicleType.toLowerCase() === 'ev';
        const rawTravelingFuel = isEv ? 'electricity' : (travelingData.fuelType || 'gasohol_e10');
        const travelingEfObj = getEFDetail(rawTravelingFuel);

        const calcInput = {
          category: 'travel' as const,
          category_type: travelingData.vehicleType.toLowerCase(),
          fuelType: rawTravelingFuel.toLowerCase(),
          distance: travelingData.distanceKm,
          trip: travelingData.trips,
          electricityKWh: travelingData.electricityKwh,
          emissionFactor: travelingEfObj.value,
          electricityEmissionFactor: electricityEfObj.value,
          efId: travelingEfObj.id,
        };

        const summary = calculateTravelSummary(calcInput);
        setTravelingEmissionTon(summary.totalCalculatedTon);
        setTravelingRawElectricityKWh(summary.rawElectricityKWh || 0);
        setTravelingElectricityCost(summary.electricityCost || 0);

        // ตัวเลือกของคำแนะนำการเดินทาง = ทุกคู่ "ชนิดรถ + เชื้อเพลิง" ที่ระบบรองรับ
        const travelingOptions: OptionType[] = [];
        Object.entries(VEHICLE_FUEL_MAPPINGS).forEach(([v, fuels]) => {
          fuels.forEach(f => travelingOptions.push({ category_type: v, fuelType: f, name: fuelLabel(v, f) }));
        });

        setTravelingRecommendation(getTravelRecommendations({
          currentEmission: summary.totalCalculatedTon,
          userInput: calcInput,
          allAvailableOptions: travelingOptions,
          fetchEFFromDB: getEFValueOrNaN,
        }));

        const travelActivityName = travelingData.travel_name || 'การเดินทาง';
        // เก็บ kWh/กม. เฉพาะรถ EV (ไม่ได้กรอกใช้ค่ามาตรฐาน) รถเชื้อเพลิงเก็บ 0
        const userEnteredTravelKwh = isEv ? (travelingData.electricityKwh || EV_KWH_PER_KM) : 0;

        // ลบข้อมูลเก่าที่ชื่อกิจกรรมเดียวกันก่อน (ทำให้บันทึกซ้ำชื่อเดิม = แก้ไขข้อมูลเดิม)
        await supabase
          .from("general_activity_traveling")
          .delete()
          .eq("org_id", orgId)
          .eq("activity_name", travelActivityName);

        const { error } = await supabase.from("general_activity_traveling").insert([{
          org_id: orgId,
          activity_name: travelActivityName,
          trips: travelingData.trips,
          distance: travelingData.distanceKm || 0,
          vehicle_type: travelingData.vehicleType.toLowerCase(),
          fuel_type: rawTravelingFuel,
          ef_id: travelingEfObj.id,
          electricity_kwh: userEnteredTravelKwh,
        }]);

        if (error) throw error;
      }

      setHasCalculated(true);
      alert("คำนวณและบันทึกข้อมูลลงฐานข้อมูลสำเร็จเรียบร้อยแล้ว!");
    } catch (error) {
      console.error("Save error:", error);
      alert(`เกิดข้อผิดพลาดในการบันทึก: ${getErrorMessage(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingSystem) {
    return <div className="text-center py-16 text-gray-500 font-medium">กำลังโหลดระบบ...</div>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8 text-gray-800">
      <h1 className="text-2xl font-bold text-gray-900">การประเมินคาร์บอนฟุตพรินต์องค์กร</h1>
      <FootprintStepper current={3} />

      <div className="space-y-6">
        <MeetingForm orgId={orgId!} onDataChange={setMeetingData} fetchElectricityEF={fetchElectricityEFFromDB} getEFDetail={getEFDetail} />
        <TravelForm orgId={orgId!} onDataChange={setTravelingData} getEFDetail={getEFDetail} />

        {/* ปุ่ม "‹ กลับ" ไปขั้นที่ 2 และปุ่มคำนวณ */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            type="button"
            onClick={goBack}
            className="btn btn-outline flex h-[60px] items-center gap-1 rounded-[20px] px-8 text-base font-semibold"
          >
            <span className="btn-arrow-back">‹</span> กลับ
          </button>
          <button
            type="button"
            onClick={handleCalculateAndSave}
            disabled={isSaving}
            className="w-full sm:w-auto rounded-xl bg-[#32885F] px-8 py-4 font-semibold text-white transition hover:bg-[#286e4d] disabled:opacity-50 shadow-md flex items-center justify-center gap-2 text-base"
          >
            <Calculator className="w-5 h-5" />
            {isSaving ? "กำลังคำนวณและบันทึก..." : "คำนวณและบันทึกข้อมูลลงฐานข้อมูล"}
          </button>
        </div>

        {hasCalculated && (
          <CalculationResult
            meetingEmission={meetingEmissionTon}
            travelEmission={travelingEmissionTon}
            meetingRawElectricityKWh={meetingRawElectricityKWh}
            meetingElectricityCost={meetingElectricityCost}
            travelRawElectricityKWh={travelingRawElectricityKWh}
            travelElectricityCost={travelingElectricityCost}
            meetingRecommendation={meetingRecommendation}
            travelRecommendation={travelingRecommendation}
          />
        )}
      </div>
    </div>
  );
}
