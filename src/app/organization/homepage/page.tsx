import React from 'react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div>
      {/* ================= 1. HERO SECTION (แบนเนอร์หลัก) ================= */}
      <section className="relative bg-gradient-to-b from-[#e8f5e9] to-[#d0ebd5] px-8 pt-12 pb-32 rounded-b-[40px]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 items-center gap-8">
          
          {/* ข้อความฝั่งซ้าย */}
          <div className="space-y-6">
            {/* ป้าย Tag สีส้มอ่อน */}
            <span className="inline-block bg-[#f8d7da] text-[#c05621] px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm">
              แพลตฟอร์มบริหารจัดการคาร์บอนสำหรับองค์กรไทย
            </span>

            {/* หัวข้อหลัก */}
            <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 leading-tight">
              ประเมิน<span className="text-[#f59e0b]">คาร์บอน</span> ชดเชยเครดิต <br />
              และยกเว้นภาษี
            </h1>

            {/* คำอธิบาย */}
            <p className="text-gray-600 text-sm md:text-base leading-relaxed">
              ครบจบในระบบเดียว ตั้งแต่คำนวณฟุตพริ้นท์ จำลองโครงการป่าไม้ T-VER <br className="hidden sm:inline" />
              ไปจนถึงประเมินสิทธิประโยชน์ทางภาษี
            </p>

            {/* ปุ่มลงทะเบียน */}
            <div className="pt-2">
              <Link 
                href="/register" 
                className="inline-flex items-center gap-2 bg-[#2d525d] text-white px-6 py-3 rounded-lg text-sm font-medium hover:bg-[#1f3a42] transition shadow-md"
              >
                ลงทะเบียน
                <span>&rarr;</span>
              </Link>
            </div>
          </div>

          {/* รูปภาพใบไม้ฝั่งขวา */}
          <div className="flex justify-center md:justify-end">
            <img 
              src="/leaf-illustration.png" 
              alt="Leaf Illustration" 
              className="w-80 md:w-96 object-contain"
            />
          </div>

        </div>
      </section>

      {/* ================= 2. FEATURE CARDS (การ์ด 3 ช่องลอยทับ) ================= */}
      <section className="max-w-5xl mx-auto px-4 -mt-20 relative z-10">
        <div className="bg-white rounded-2xl shadow-xl p-8 grid grid-cols-1 md:grid-cols-3 gap-8 border border-gray-100">
          
          {/* การ์ดที่ 1 */}
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full border-2 border-[#1c5d41] flex items-center justify-center text-[#1c5d41]">
              🌐
            </div>
            <h3 className="font-bold text-gray-800 text-base">คาร์บอนฟุตพริ้นท์องค์กร</h3>
            <p className="text-gray-500 text-xs leading-relaxed">
              บันทึกและติดตามการปล่อยก๊าซเรือนกระจก Scope 1–3 พร้อมกราฟวิเคราะห์แบบเรียลไทม์
            </p>
          </div>

          {/* การ์ดที่ 2 */}
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full border-2 border-[#1c5d41] flex items-center justify-center text-[#1c5d41]">
              🍃
            </div>
            <h3 className="font-bold text-gray-800 text-base">จำลองโครงการป่าไม้ T-VER</h3>
            <p className="text-gray-500 text-xs leading-relaxed">
              จำลองจากการเติบโตของป่าไม้และประเมินคาร์บอนเครดิตที่จะได้รับตลอด 3 ปี
            </p>
          </div>

          {/* การ์ดที่ 3 */}
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-full border-2 border-[#1c5d41] flex items-center justify-center text-[#1c5d41]">
              📜
            </div>
            <h3 className="font-bold text-gray-800 text-base">ประเมินสิทยกเว้นภาษี</h3>
            <p className="text-gray-500 text-xs leading-relaxed">
              คำนวณรายได้จำลองจากการขายเครดิต และมูลค่ากำไรที่ได้รับยกเว้นภาษีนิติบุคคล
            </p>
          </div>

        </div>
      </section>

      {/* ================= 3. SECTION: ทำไมต้องเลือกเรา ================= */}
      <section className="max-w-5xl mx-auto px-8 py-20">
        <h2 className="text-3xl font-extrabold text-gray-900 mb-4">
          ทำไมต้องเลือกเรา?
        </h2>
        <p className="text-gray-600 text-base leading-relaxed max-w-2xl">
          ข้อมูลเชื่อมถึงกันทุกส่วน — บันทึกฟุตพริ้นท์ครั้งเดียว <br />
          ใช้ได้ทั้งจัดสรรเครดิตและคำนวณภาษี ไม่ต้องลงข้อมูลซ้ำ
        </p>
      </section>
    </div>
  );
}