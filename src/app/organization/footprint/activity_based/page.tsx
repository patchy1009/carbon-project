"use client";

import React, { useState, useEffect } from "react";
import MeetingForm, { MeetingData } from "./components/EventForm";
import TravelForm, { TravelData } from "./components/TravelForm";
import CalculationResult from "./components/CalculationResult";
import {
  calculateMeetingSummary,
  calculateTravelSummary,
  getTravelRecommendations,
  getMeetingRecommendations,
  VEHICLE_FUEL_MAPPINGS,
  OptionType
} from "./calculation";
import FootprintStepper from "@/components/FootprintStepper";
import { supabase } from "@/lib/supabaseClient";
import { Calculator, Trash2, ChevronDown } from "lucide-react";

export default function ActivityBasedFootprintPage() {
  const [projectTitle, setProjectTitle] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [travel, setTravel] = useState<TravelData | null>(null);

  const [emissionFactorsList, setEmissionFactorsList] = useState<any[]>([]);
  const [existingActivities, setExistingActivities] = useState<any[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState<string>("NEW");

  const [loadingActivities, setLoadingActivities] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [meetingEmissionTon, setMeetingEmissionTon] = useState<number>(0);
  const [travelEmissionTon, setTravelEmissionTon] = useState<number>(0);
  const [meetingRawElectricityKWh, setMeetingRawElectricityKWh] = useState<number>(0);
  const [meetingElectricityCost, setMeetingElectricityCost] = useState<number>(0);

  const [meetingRecommendation, setMeetingRecommendation] = useState<any>(null);
  const [travelRecommendation, setTravelRecommendation] = useState<any>(null);

  const [travelRawElectricityKWh, setTravelRawElectricityKWh] = useState<number>(0);
  const [travelElectricityCost, setTravelElectricityCost] = useState<number>(0);

  useEffect(() => {
    async function fetchMasterData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data: efData, error: efError } = await supabase
          .from('emission_factor')
          .select('*, eftype:eftype_id (type_name)');
        if (efError) throw efError;
        if (efData) setEmissionFactorsList(efData);

        if (user) {
          const { data: actData, error: actError } = await supabase
            .from('general_activity')
            .select('*')
            .eq('org_id', user.id)
            .order('created_at', { ascending: false });
          if (!actError && actData) {
            setExistingActivities(actData);
          }
        }
      } catch (err) {
        console.error("ไม่สามารถดึงข้อมูลได้:", err);
      } finally {
        setLoadingActivities(false);
      }
    }

    fetchMasterData();
  }, []);

  const fetchElectricityEFFromDB = () => {
    const matchedItem = emissionFactorsList.find((ef: any) => {
      const efName = (ef.ef_name || '').toLowerCase();
      const efType = (ef.eftype?.type_name || '').toLowerCase();
      return efName.includes('grid') || efName.includes('ไฟฟ้า') || efType.includes('electricity');
    });

    return {
      id: matchedItem ? (matchedItem.ef_id || matchedItem.id || null) : null,
      value: matchedItem ? Number(matchedItem.ef_value) || 0.4999 : 0.4999
    };
  };

  const getEFDetail = (fuelKey: string) => {
    if (!fuelKey) return { id: null, value: 0.5 };
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

    let matchedItem = emissionFactorsList.find((ef: any) => {
      const efName = (ef.ef_name || '').toLowerCase();
      const efType = (ef.eftype?.type_name || '').toLowerCase();
      const efFuelType = (ef.fuel_type || '').toLowerCase();

      return (
        efName.includes(targetKeyword) ||
        efType.includes(targetKeyword) ||
        efFuelType.includes(targetKeyword)
      );
    });

    return {
      id: matchedItem ? (matchedItem.ef_id || matchedItem.id || null) : null,
      value: matchedItem ? Number(matchedItem.ef_value) || 0.5 : 0.5
    };
  };

  const generateRecommendations = (mMeetingData: MeetingData | null, mTrData: TravelData | null) => {
    const electricityEfObj = fetchElectricityEFFromDB();

    if (mMeetingData) {
      const isMeetingEv = mMeetingData.meetingType === 'onsite' && mMeetingData.fuelType?.toLowerCase() === 'ev';
      const rawFuel = mMeetingData.meetingType === 'online' ? 'electricity' : (isMeetingEv ? 'electricity' : (mMeetingData.fuelType || 'gasohol_e10'));
      const meetingEfObj = mMeetingData.meetingType === 'online' ? electricityEfObj : getEFDetail(rawFuel);

      const calcInput = {
        category: 'meeting' as const,
        subCategory: mMeetingData.meetingType,
        fuelType: rawFuel.toLowerCase(),
        distance: mMeetingData.distanceKm,
        trip: mMeetingData.trips,
        durationHours: mMeetingData.durationHours,
        equipmentSets: mMeetingData.equipmentSets,
        emissionFactor: meetingEfObj.value,
        electricityEmissionFactor: electricityEfObj.value,
        efId: meetingEfObj.id,
      };

      const meetingSummaryRes = calculateMeetingSummary(calcInput);
      setMeetingEmissionTon(meetingSummaryRes.totalCalculatedTon);
      setMeetingRawElectricityKWh(meetingSummaryRes.rawElectricityKWh);
      setMeetingElectricityCost(meetingSummaryRes.electricityCost);

      const meetingOptions: OptionType[] = [
        { subCategory: 'online', fuelType: 'electricity', name: 'การประชุมออนไลน์ (Online)' },
        { subCategory: 'ev', fuelType: 'electricity', name: 'ประชุมออนไซต์ รถไฟฟ้า EV' },
        { subCategory: 'car', fuelType: 'gasohol_e20', name: 'ประชุมออนไซต์ รถยนต์ (Gasohol E20)' },
        { subCategory: 'motorcycle', fuelType: 'gasohol_e10', name: 'ประชุมออนไซต์ รถจักรยานยนต์' },
      ];

      setMeetingRecommendation(getMeetingRecommendations({
        currentEmission: meetingSummaryRes.totalCalculatedTon,
        userInput: calcInput,
        allAvailableOptions: meetingOptions,
        fetchEFFromDB: (fuelKey) => getEFDetail(fuelKey).value,
        fetchElectricityEFFromDB: () => electricityEfObj.value,
      }));
    }

    if (mTrData) {
      const isEv = mTrData.vehicleType.toLowerCase() === 'ev';
      const rawTravelFuel = isEv ? 'electricity' : (mTrData.fuelType || 'gasohol_e10');
      const travelEfObj = getEFDetail(rawTravelFuel);

      const calcInput = {
        category: 'travel' as const,
        subCategory: mTrData.vehicleType.toLowerCase(),
        fuelType: rawTravelFuel.toLowerCase(),
        distance: mTrData.distanceKm,
        trip: mTrData.trips,
        electricityKWh: mTrData.electricityKwh,
        emissionFactor: travelEfObj.value,
        electricityEmissionFactor: electricityEfObj.value,
        efId: travelEfObj.id,
      };

      const travelSummaryRes = calculateTravelSummary(calcInput);
      setTravelEmissionTon(travelSummaryRes.totalCalculatedTon);
      setTravelRawElectricityKWh(travelSummaryRes.rawElectricityKWh || 0);
      setTravelElectricityCost(travelSummaryRes.electricityCost || 0);

      const travelOptions: OptionType[] = [];
      Object.entries(VEHICLE_FUEL_MAPPINGS).forEach(([v, fuels]) => {
        fuels.forEach(f => travelOptions.push({ subCategory: v, fuelType: f, name: `${v} (${f})` }));
      });

      setTravelRecommendation(getTravelRecommendations({
        currentEmission: travelSummaryRes.totalCalculatedTon,
        userInput: calcInput,
        allAvailableOptions: travelOptions,
        fetchEFFromDB: (fuelKey) => getEFDetail(fuelKey).value,
      }));
    }
  };

  const handleSelectActivity = async (activityId: string) => {
    setSelectedActivityId(activityId);
    setIsDropdownOpen(false);

    if (activityId === "NEW") {
      setProjectTitle("");
      setMeetingData(null);
      setTravel(null);
      setMeetingEmissionTon(0);
      setTravelEmissionTon(0);
      setMeetingRawElectricityKWh(0);
      setMeetingElectricityCost(0);
      setTravelRawElectricityKWh(0);
      setTravelElectricityCost(0);
      setMeetingRecommendation(null);
      setTravelRecommendation(null);
      return;
    }

    try {
      const { data: selectedAct, error: actError } = await supabase
        .from("general_activity")
        .select("*")
        .eq("general_activity_id", activityId)
        .single();

      if (actError) throw actError;
      if (!selectedAct) return;

      setProjectTitle(selectedAct.activity_title || "");

      let loadedMeetingData: MeetingData | null = null;
      let loadedTravelData: TravelData | null = null;

      if (selectedAct.meeting_id) {
        const { data: meetingDetail, error: meetingError } = await supabase
          .from("general_activity_meeting_detail")
          .select("*")
          .eq("meeting_id", selectedAct.meeting_id)
          .single();

        if (!meetingError && meetingDetail) {
          loadedMeetingData = {
            meetingName: meetingDetail.category_name || "",
            meetingType: selectedAct.event_type || "online",
            durationHours: Number(meetingDetail.hours) || 1,
            equipmentSets: [
              {
                equipmentName: meetingDetail.equipment_name || 'อุปกรณ์การประชุม',
                devices: Number(meetingDetail.devices) || 1,
                durationHours: Number(meetingDetail.hours) || 1,
                electricityKwh: Number(meetingDetail.electricity_kwh || 0.1),
              }
            ],
            vehicleType: meetingDetail.vehicle_type || "car",
            fuelType: meetingDetail.fuel_type || "Gasohol_E10",
            distanceKm: Number(meetingDetail.distance) || 0,
            trips: Number(meetingDetail.trips) || 1,
            ef_id: meetingDetail.ef_id,
          };
          setMeetingData(loadedMeetingData);
        } else {
          setMeetingData(null);
        }
      } else {
        setMeetingData(null);
      }

      if (selectedAct.traveling_id) {
        const { data: travelDetail, error: travelError } = await supabase
          .from("general_activity_travel_detail")
          .select("*")
          .eq("traveling_id", selectedAct.traveling_id)
          .single();

        if (!travelError && travelDetail) {
          loadedTravelData = {
            travel_name: travelDetail.category_name || "",
            distanceKm: Number(travelDetail.distance) || 0,
            trips: Number(travelDetail.trips) || 1,
            vehicleType: travelDetail.vehicle_type || "car",
            fuelType: travelDetail.fuel_type || "Gasohol_E10",
            electricityKwh: Number(travelDetail.electricity_kwh) || 0.16,
            ef_id: travelDetail.ef_id,
          };
          setTravel(loadedTravelData);
        } else {
          setTravel(null);
        }
      } else {
        setTravel(null);
      }

      generateRecommendations(loadedMeetingData, loadedTravelData);

    } catch (err: any) {
      console.error("เกิดข้อผิดพลาดในการดึงข้อมูลกิจกรรมเดิม:", err.message || err);
    }
  };

  const handleDeleteActivity = async (activityId: string, actTitle: string) => {
    if (!window.confirm(`คุณต้องการลบกิจกรรม "${actTitle}" จริงๆ ใช่หรือไม่?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('general_activity')
        .delete()
        .eq('general_activity_id', activityId);

      if (error) throw error;

      setExistingActivities(prev => prev.filter(item => item.general_activity_id !== activityId));
      if (selectedActivityId === activityId) {
        handleSelectActivity("NEW");
      }
      alert("ลบกิจกรรมสำเร็จ!");
    } catch (err: any) {
      console.error("Error deleting activity:", err.message);
      alert("เกิดข้อผิดพลาดในการลบกิจกรรม");
    }
  };

  const handleCalculateAndSave = async () => {
    if (!projectTitle.trim()) {
      alert("กรุณากรอกหรือเลือกชื่อกิจกรรมรวม (ชื่อโครงการหลัก) ก่อนทำการบันทึก");
      return;
    }

    if (!meetingData && !travel) {
      alert("กรุณากรอกข้อมูลการประชุม หรือข้อมูลการเดินทางอย่างน้อย 1 หมวด");
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        alert("กรุณาเข้าสู่ระบบก่อนทำการบันทึกข้อมูล");
        setIsSaving(false);
        return;
      }

      const orgId = user.id;
      const electricityEfObj = fetchElectricityEFFromDB();

      let meetingCalculatedTotal = 0;
      let travelCalculatedTotal = 0;
      let totalElectricityKWh = 0;
      let totalCostVal = 0;
      let parentCategoryName = "";

      if (meetingData) {
        const isMeetingEv = meetingData.meetingType === 'onsite' && meetingData.fuelType?.toLowerCase() === 'ev';
        const rawFuel = meetingData.meetingType === 'online' ? 'electricity' : (isMeetingEv ? 'electricity' : (meetingData.fuelType || 'gasohol_e10'));
        const meetingEfObj = meetingData.meetingType === 'online' ? electricityEfObj : getEFDetail(rawFuel);

        const calcInput = {
          category: 'meeting' as const,
          subCategory: meetingData.meetingType,
          fuelType: rawFuel.toLowerCase(),
          distance: meetingData.distanceKm,
          trip: meetingData.trips,
          durationHours: meetingData.durationHours,
          equipmentSets: meetingData.equipmentSets,
          emissionFactor: meetingEfObj.value,
          electricityEmissionFactor: electricityEfObj.value,
          efId: meetingEfObj.id,
        };

        const meetingSummaryRes = calculateMeetingSummary(calcInput);
        meetingCalculatedTotal = meetingSummaryRes.totalCalculatedTon;
        totalElectricityKWh += meetingSummaryRes.rawElectricityKWh || 0;
        totalCostVal += meetingSummaryRes.electricityCost || 0;
        parentCategoryName = meetingData.meetingName || "การประชุม";
      }

      if (travel) {
        const isEv = travel.vehicleType.toLowerCase() === 'ev';
        const rawTravelFuel = isEv ? 'electricity' : (travel.fuelType || 'gasohol_e10');
        const travelEfObj = getEFDetail(rawTravelFuel);

        const calcInput = {
          category: 'travel' as const,
          subCategory: travel.vehicleType.toLowerCase(),
          fuelType: rawTravelFuel.toLowerCase(),
          distance: travel.distanceKm,
          trip: travel.trips,
          electricityKWh: travel.electricityKwh,
          emissionFactor: travelEfObj.value,
          electricityEmissionFactor: electricityEfObj.value,
          efId: travelEfObj.id,
        };

        const travelSummaryRes = calculateTravelSummary(calcInput);
        travelCalculatedTotal = travelSummaryRes.totalCalculatedTon;
        totalElectricityKWh += travelSummaryRes.rawElectricityKWh || 0;
        totalCostVal += travelSummaryRes.electricityCost || 0;

        if (!parentCategoryName) {
          parentCategoryName = travel.travel_name || "การเดินทาง";
        }
      }

      const grandTotalCalculated = Number((meetingCalculatedTotal + travelCalculatedTotal).toFixed(4));
      const isEditMode = selectedActivityId !== "NEW";
      const finalTitle = projectTitle.trim();

      let currentActivityId = selectedActivityId;

      const parentPayload = {
        org_id: orgId,
        activity_title: finalTitle,
        category_name: parentCategoryName,
        event_type: meetingData ? meetingData.meetingType : null,
        total_calculated: grandTotalCalculated,
        total_event_calculated: Number(meetingCalculatedTotal.toFixed(4)),
        total_travel_calculated: Number(travelCalculatedTotal.toFixed(4)),
        total_electricity_calculated: Number(totalElectricityKWh.toFixed(4)),
        total_cost_calculated: Number(totalCostVal.toFixed(2)),
        updated_at: new Date().toISOString(),
      };

      if (isEditMode) {
        const { error: updateError } = await supabase
          .from("general_activity")
          .update(parentPayload)
          .eq("general_activity_id", currentActivityId);

        if (updateError) throw updateError;
      } else {
        const { data: parentData, error: parentError } = await supabase
          .from("general_activity")
          .insert([{ ...parentPayload, created_at: new Date().toISOString() }])
          .select("general_activity_id")
          .single();

        if (parentError || !parentData) {
          throw parentError || new Error("ไม่สามารถบันทึกข้อมูลตารางแม่ได้");
        }

        currentActivityId = parentData.general_activity_id;
        setSelectedActivityId(currentActivityId);
      }

      let savedMeetingId: string | null = null;
      let savedTravelingId: string | null = null;

      if (meetingData) {
        const isMeetingEv = meetingData.meetingType === 'onsite' && meetingData.fuelType?.toLowerCase() === 'ev';
        const rawFuel = meetingData.meetingType === 'online' ? 'electricity' : (isMeetingEv ? 'electricity' : (meetingData.fuelType || 'gasohol_e10'));
        const meetingEfObj = meetingData.meetingType === 'online' ? electricityEfObj : getEFDetail(rawFuel);
        const firstSet = meetingData.equipmentSets?.[0];

        const meetingPayload = {
          general_activity_id: currentActivityId,
          category_name: parentCategoryName,
          hours: firstSet?.durationHours || meetingData.durationHours || 1,
          devices: firstSet?.devices || 1,
          equipment_name: firstSet?.equipmentName || 'อุปกรณ์การประชุม',
          vehicle_type: meetingData.meetingType === 'onsite' ? (meetingData.fuelType ? 'car' : 'onsite') : 'online',
          fuel_type: meetingData.meetingType === 'onsite' ? (meetingData.fuelType || 'gasohol_e10') : 'electricity',
          ef_id: meetingEfObj.id,
          distance: meetingData.distanceKm || 0,
          trips: meetingData.trips || 1,
        };

        const { data: insMeetingData, error: insMeetingErr } = await supabase
          .from("general_activity_meeting_detail")
          .insert([meetingPayload])
          .select("meeting_id")
          .single();

        if (insMeetingErr) throw insMeetingErr;
        if (insMeetingData) savedMeetingId = insMeetingData.meeting_id;
      }

      if (travel) {
        const isEv = travel.vehicleType.toLowerCase() === 'ev';
        const rawTravelFuel = isEv ? 'electricity' : (travel.fuelType || 'gasohol_e10');
        const travelEfObj = getEFDetail(rawTravelFuel);

        const travelPayload = {
          general_activity_id: currentActivityId,
          category_name: travel.travel_name || "การเดินทาง",
          trips: travel.trips,
          distance: travel.distanceKm || 0,
          vehicle_type: travel.vehicleType.toLowerCase(),
          fuel_type: rawTravelFuel,
          ef_id: travelEfObj.id,
        };

        const { data: insTrData, error: insTrErr } = await supabase
          .from("general_activity_travel_detail")
          .insert([travelPayload])
          .select("traveling_id")
          .single();

        if (insTrErr) throw insTrErr;
        if (insTrData) savedTravelingId = insTrData.traveling_id;
      }

      await supabase
        .from("general_activity")
        .update({
          meeting_id: savedMeetingId,
          traveling_id: savedTravelingId,
        })
        .eq("general_activity_id", currentActivityId);

      generateRecommendations(meetingData, travel);

      const { data: refreshedActs } = await supabase
        .from('general_activity')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false });
      if (refreshedActs) setExistingActivities(refreshedActs);

      alert(isEditMode ? "อัปเดตข้อมูลกิจกรรมรวมสำเร็จ!" : "สร้างและบันทึกกิจกรรมรวมสำเร็จ!");
    } catch (error: any) {
      console.error("เกิดข้อผิดพลาดในการบันทึก:", error.message || error);
      alert(`เกิดข้อผิดพลาด: ${error.message || "กรุณาตรวจสอบ Console"}`);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedActivityObj = existingActivities.find(a => a.general_activity_id === selectedActivityId);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-6 py-8 font-['Be_Vietnam_Pro'] text-gray-800">
      <h1 className="text-2xl font-bold text-gray-900">
        การประเมินคาร์บอนฟุตพริ้นท์องค์กร
      </h1>

      <FootprintStepper current={3} />

      {loadingActivities ? (
        <div className="text-center py-8 text-gray-500">กำลังโหลดระบบ...</div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              ชื่อกิจกรรมรวม / โครงการหลัก *
            </label>
            
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={projectTitle}
                  onChange={(e) => {
                    const val = e.target.value;
                    setProjectTitle(val);
                    setIsDropdownOpen(true);
                    
                    const matched = existingActivities.find(a => a.activity_title === val);
                    if (matched) {
                      handleSelectActivity(matched.general_activity_id);
                    } else {
                      setSelectedActivityId("NEW");
                    }
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                  placeholder="พิมพ์ตั้งชื่อกิจกรรมใหม่ หรือคลิกเพื่อเลือกกิจกรรมเดิม..."
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-[#32885F] focus:outline-none bg-white font-medium pr-10 shadow-sm"
                />
                
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                  <ChevronDown className="w-4 h-4" />
                </div>

                {isDropdownOpen && (
                  <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg text-sm font-medium text-gray-700">
                    <li
                      onMouseDown={() => handleSelectActivity("NEW")}
                      className="cursor-pointer px-4 py-2.5 hover:bg-emerald-50 text-[#32885F] font-semibold border-b border-gray-100 flex items-center justify-between"
                    >
                      <span>➕ สร้างกิจกรรมรวมใหม่</span>
                    </li>
                    {existingActivities
                      .filter(act => (act.activity_title || "").toLowerCase().includes(projectTitle.toLowerCase()))
                      .map((act) => (
                        <li
                          key={act.general_activity_id}
                          onMouseDown={() => handleSelectActivity(act.general_activity_id)}
                          className="cursor-pointer px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between text-gray-700"
                        >
                          <span>{act.activity_title}</span>
                          <span className="text-xs text-gray-400">
                            {new Date(act.created_at).toLocaleDateString('th-TH')}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              {selectedActivityId !== "NEW" && selectedActivityObj && (
                <button
                  type="button"
                  onClick={() => handleDeleteActivity(selectedActivityObj.general_activity_id, selectedActivityObj.activity_title)}
                  className="p-3 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-xl transition border border-red-200 flex-shrink-0"
                  title="ลบกิจกรรมนี้"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>

            <p className="text-xs text-gray-400">
              * พิมพ์ตั้งชื่อใหม่ได้ทันที หรือคลิกที่ช่องเพื่อเลือกจากกิจกรรมเดิม
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <MeetingForm
              key={`meeting-${selectedActivityId}`}
              initialData={meetingData}
              onSubmit={(data) => {
                setMeetingData(data);
                generateRecommendations(data, travel);
              }}
            />
            <TravelForm
              key={`travel-${selectedActivityId}`}
              initialData={travel}
              onSubmit={(data) => {
                setTravel(data);
                generateRecommendations(meetingData, data);
              }}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleCalculateAndSave}
              disabled={isSaving}
              className="rounded-xl bg-[#32885F] px-8 py-4 font-semibold text-white transition hover:bg-[#286e4d] disabled:opacity-50 shadow-md flex items-center gap-2"
            >
              <Calculator className="w-5 h-5" /> {isSaving ? "กำลังบันทึก..." : "คำนวณและบันทึก Carbon Footprint"}
            </button>
          </div>

          <CalculationResult
            meetingEmission={meetingEmissionTon}
            travelEmission={travelEmissionTon}
            resourceEmission={0}
            meetingRawElectricityKWh={meetingRawElectricityKWh}
            meetingElectricityCost={meetingElectricityCost}
            travelRawElectricityKWh={travelRawElectricityKWh}
            travelElectricityCost={travelElectricityCost}
            meetingRecommendation={meetingRecommendation}
            travelRecommendation={travelRecommendation}
          />
        </div>
      )}
    </div>
  );
}