// "use client";

// import { useState } from "react";
// import Modal from "@/components/Modal";

// type DocumentItem = {
//   name: string;
//   type: string;
//   file: string;
//   version: string;
//   status: string;
//   kind: "success" | "warning";
// };

// // Keep the original file for storage and a separate name for table display.
// type AttachedFile = {
//   file: File;
//   displayName: string;
// };

// const initialDocuments: DocumentItem[] = [
//   { name: "แบบฟอร์มขึ้นทะเบียนโครงการ T-VER", type: "เอกสารสมัคร", file: "tver-form.docx", version: "v3", status: "ใช้งานอยู่", kind: "success" },
//   { name: "เอกสารรับรองสิทธิ์การใช้ที่ดิน", type: "เอกสารประกอบ", file: "land-right.pdf", version: "v1", status: "ใช้งานอยู่", kind: "success" },
//   { name: "แบบสรุปข้อมูลการปล่อยก๊าซเรือนกระจกรายปี", type: "แบบรายงาน", file: "emission-report.xlsx", version: "v2", status: "อัปเดตล่าสุด", kind: "warning" },
// ];

// export default function DocumentsPage() {
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [documents, setDocuments] = useState(initialDocuments);
//   // Holds files selected in the modal before the user saves them.
//   const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

//   // Add every selected file and start its editable display name with the filename.
//   const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
//     const selectedFiles = Array.from(event.target.files ?? []);
//     if (selectedFiles.length === 0) return;

//     setAttachedFiles((currentFiles) => [
//       ...currentFiles,
//       ...selectedFiles.map((file) => ({ file, displayName: file.name })),
//     ]);
//     event.target.value = "";
//   };

//   // Add the selected files to the table, then clear and close the modal.
//   const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
//     event.preventDefault();
//     if (attachedFiles.length === 0) return;

//     setDocuments((currentDocuments) => [
//       ...currentDocuments,
//       ...attachedFiles.map(({ file, displayName }) => ({
//         name: displayName,
//         type: "เอกสารแนบ",
//         file: file.name,
//         version: "v1",
//         status: "รอใช้งาน",
//         kind: "warning" as const,
//       })),
//     ]);
//     setAttachedFiles([]);
//     setIsModalOpen(false);
//   };

//   return (
//     <section>
//       <div className="mb-6 flex items-end justify-between">
//         <div><h1 className="text-2xl font-semibold text-[#152420]">จัดการเอกสารที่ต้องใช้</h1><p className="mt-1 text-sm text-[#67766F]">แม่แบบเอกสารสำหรับโครงการคาร์บอนเครดิตและรายงานการปล่อยก๊าซเรือนกระจก</p></div>
//         <button  onClick={() => setIsModalOpen(true)} className="rounded-xl bg-[#158C69] px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-[#117056]">+ เพิ่มเอกสาร</button>
//       </div>

//       <div className="mb-5 flex gap-6 border-b border-[#E7ECE9] text-sm font-medium">
//         <button className="relative pb-3 text-[#152420] after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-[3px] after:bg-[#22AD82]">เอกสารโครงการคาร์บอนเครดิต</button>
//         <button className="pb-3 text-[#67766F] hover:text-[#152420]">เอกสารจัดทำรายงานการปล่อย/ดูดกลับก๊าซเรือนกระจก</button>
//       </div>

//       <div className="overflow-hidden rounded-xl border border-[#E7ECE9] bg-white shadow-sm">
//         <div className="overflow-x-auto">
//           <table className="w-full text-sm">
//             <thead><tr className="bg-[#E7ECE9]/40 text-xs text-[#67766F]">
//               {["ชื่อเอกสาร","ประเภท","Template File","เวอร์ชัน","สถานะ","การดำเนินการ"].map(h => <th key={h} className={`px-6 py-3 font-medium ${h==="การดำเนินการ"?"text-right":"text-left"}`}>{h}</th>)}
//             </tr></thead>
//             <tbody className="divide-y divide-[#E7ECE9]">
//               {documents.map(({ name, type, file, version, status, kind }) => (
//                 <tr key={`${name}-${file}`} className="hover:bg-[#F0FBF7]">
//                   <td className="px-6 py-3.5 font-medium text-[#152420]">{name}</td><td className="px-6 py-3.5 text-[#67766F]">{type}</td><td className="px-6 py-3.5 font-medium text-[#117056]">▧ {file}</td><td className="px-6 py-3.5 font-mono text-[#67766F]">{version}</td>
//                   <td className="px-6 py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${kind==="success"?"bg-[#DEF7EC] text-[#0F4A3B]":"bg-amber-100 text-amber-800"}`}>{status}</span></td>
//                   <td className="px-6 py-3.5 text-right whitespace-nowrap"><button className="px-2.5 py-1.5 text-xs font-medium text-[#117056]">แก้ไข</button><button className="px-2.5 py-1.5 text-xs font-medium text-red-600">ลบ</button></td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       <Modal
//         isOpen={isModalOpen}
//         onClose={() => setIsModalOpen(false)}
//         title="เพิ่มเอกสาร"
//       >
//         <form onSubmit={handleSave} className="space-y-5">
//           <div>
//             <label htmlFor="document-files" className="mb-2 block text-sm font-medium text-[#152420]">
//               แนบไฟล์เอกสาร
//             </label>
//             <input
//               id="document-files"
//               type="file"
//               multiple
//               onChange={handleFilesSelected}
//               className="block w-full cursor-pointer rounded-lg border border-[#D6E2DC] bg-[#F8FBF9] text-sm text-[#67766F] file:mr-4 file:border-0 file:bg-[#DEF7EC] file:px-4 file:py-2.5 file:font-medium file:text-[#0F4A3B]"
//             />
//             <p className="mt-1.5 text-xs text-[#67766F]">สามารถเลือกไฟล์ได้มากกว่าหนึ่งไฟล์</p>
//           </div>

//           {attachedFiles.length > 0 && (
//             <div className="space-y-3">
//               <p className="text-sm font-medium text-[#152420]">ไฟล์ที่เลือก ({attachedFiles.length})</p>
//               {attachedFiles.map(({ file, displayName }, index) => (
//                 <div key={`${file.name}-${file.lastModified}-${index}`} className="rounded-lg border border-[#E7ECE9] p-3">
//                   <p className="mb-2 truncate text-xs text-[#67766F]">ไฟล์ต้นฉบับ: {file.name}</p>
//                   <label htmlFor={`display-name-${index}`} className="mb-1 block text-xs font-medium text-[#152420]">
//                     ชื่อที่แสดง
//                   </label>
//                   <input
//                     id={`display-name-${index}`}
//                     type="text"
//                     value={displayName}
//                     onChange={(event) => setAttachedFiles((currentFiles) => currentFiles.map((item, itemIndex) => itemIndex === index ? { ...item, displayName: event.target.value } : item))}
//                     required
//                     className="w-full rounded-lg border border-[#D6E2DC] px-3 py-2 text-sm text-[#152420] outline-none focus:border-[#158C69] focus:ring-2 focus:ring-[#158C69]/20"
//                   />
//                 </div>
//               ))}
//             </div>
//           )}

//           <div className="flex justify-end gap-3 border-t border-[#E7ECE9] pt-4">
//             <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-[#D6E2DC] px-4 py-2 text-sm font-medium text-[#67766F] hover:bg-[#F8FBF9]">
//               ยกเลิก
//             </button>
//             <button type="submit" disabled={attachedFiles.length === 0} className="rounded-lg bg-[#158C69] px-4 py-2 text-sm font-medium text-white hover:bg-[#117056] disabled:cursor-not-allowed disabled:opacity-50">
//               บันทึก
//             </button>
//           </div>
//         </form>
//       </Modal>

//     </section>
//   );
// }

"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/Modal";
import { supabase } from "../../../lib/supabaseClient";

type DocumentItem = {
  id: string;
  title: string;
  link: string;
  created_at: string;
};

type AttachedFile = {
  file: File;
  displayName: string;
};

export default function DocumentsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // =========================
  // Load documents
  // =========================
  const loadDocuments = async () => {
    setIsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("documents")
      .select("id, title, link, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load documents error:", error);
      setErrorMessage(error.message);
      setDocuments([]);
    } else {
      setDocuments(data ?? []);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  // =========================
  // Select files
  // =========================
  const handleFilesSelected = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);

    const newFiles: AttachedFile[] = files.map((file) => ({
      file,
      displayName: file.name,
    }));

    setAttachedFiles((prev) => [...prev, ...newFiles]);

    // reset input
    event.target.value = "";
  };

  // =========================
  // Remove selected file
  // =========================
  const handleRemoveAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // =========================
  // Save documents
  // =========================
  const handleSave = async () => {
    if (attachedFiles.length === 0) {
      setErrorMessage("กรุณาเลือกไฟล์ก่อน");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    const uploadedPaths: string[] = [];

    try {
      for (const attached of attachedFiles) {
        const file = attached.file;

        // สร้างชื่อไฟล์ไม่ให้ชนกัน
        const fileName = `${Date.now()}-${Math.random()
          .toString(36)
          .substring(2, 10)}-${file.name}`;

        // =========================
        // Upload to Supabase Storage
        // =========================
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(fileName, file);

        if (uploadError) {
          throw new Error(
            `อัปโหลดไฟล์ "${file.name}" ไม่สำเร็จ: ${uploadError.message}`
          );
        }

        uploadedPaths.push(fileName);

        // =========================
        // Insert into database
        // =========================
        const { error: insertError } = await supabase
          .from("documents")
          .insert({
            title: attached.displayName,
            link: fileName,
          });

        if (insertError) {
          // ถ้า insert DB ไม่สำเร็จ ให้ลบไฟล์ที่ upload ไปแล้ว
          await supabase.storage
            .from("documents")
            .remove([fileName]);

          throw new Error(
            `บันทึกข้อมูล "${file.name}" ไม่สำเร็จ: ${insertError.message}`
          );
        }
      }

      // =========================
      // Success
      // =========================
      setAttachedFiles([]);
      setIsModalOpen(false);

      await loadDocuments();
    } catch (error) {
      console.error("Save documents error:", error);

      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("เกิดข้อผิดพลาดในการบันทึกไฟล์");
      }

      // cleanup กรณีมีไฟล์ที่ upload สำเร็จไปก่อนหน้า
      if (uploadedPaths.length > 0) {
        await supabase.storage
          .from("documents")
          .remove(uploadedPaths);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // =========================
  // Delete document
  // =========================
  const handleDelete = async (document: DocumentItem) => {
    const confirmed = window.confirm(
      `ต้องการลบ "${document.title}" หรือไม่?`
    );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");

    try {
      // ลบไฟล์จาก Storage
      if (document.link) {
        const { error: storageError } = await supabase.storage
          .from("documents")
          .remove([document.link]);

        if (storageError) {
          console.error("Delete storage error:", storageError);
        }
      }

      // ลบข้อมูลจาก database
      const { error: deleteError } = await supabase
        .from("documents")
        .delete()
        .eq("id", document.id);

      if (deleteError) {
        throw new Error(
          `ลบข้อมูลไม่สำเร็จ: ${deleteError.message}`
        );
      }

      await loadDocuments();
    } catch (error) {
      console.error("Delete document error:", error);

      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("เกิดข้อผิดพลาดในการลบไฟล์");
      }
    }
  };

  // =========================
  // Open file
  // =========================
  const handleOpenFile = async (document: DocumentItem) => {
    setErrorMessage("");

    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(document.link, 60);

      if (error) {
        throw new Error(
          `ไม่สามารถเปิดไฟล์ได้: ${error.message}`
        );
      }

      if (!data?.signedUrl) {
        throw new Error("ไม่พบ URL ของไฟล์");
      }

      window.open(data.signedUrl, "_blank");
    } catch (error) {
      console.error("Open document error:", error);

      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("ไม่สามารถเปิดไฟล์ได้");
      }
    }
  };

  return (
    <div className="p-6">
      {/* =========================
          Header
      ========================= */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            จัดการเอกสาร
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            เพิ่ม ลบ และเปิดดูเอกสาร
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMessage("");
            setAttachedFiles([]);
            setIsModalOpen(true);
          }}
          className="rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800"
        >
          + เพิ่มเอกสาร
        </button>
      </div>

      {/* =========================
          Error
      ========================= */}
      {errorMessage && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {/* =========================
          Documents Table
      ========================= */}
      <div className="overflow-hidden rounded-xl border bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">
            กำลังโหลดข้อมูล...
          </div>
        ) : documents.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            ยังไม่มีเอกสาร
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">
                  ชื่อเอกสาร
                </th>

                <th className="px-4 py-3 text-left text-sm font-semibold">
                  วันที่เพิ่ม
                </th>

                <th className="px-4 py-3 text-right text-sm font-semibold">
                  จัดการ
                </th>
              </tr>
            </thead>

            <tbody>
              {documents.map((document) => (
                <tr
                  key={document.id}
                  className="border-b last:border-b-0"
                >
                  <td className="px-4 py-4">
                    <div className="font-medium">
                      {document.title}
                    </div>
                  </td>

                  <td className="px-4 py-4 text-sm text-gray-500">
                    {new Date(
                      document.created_at
                    ).toLocaleString("th-TH")}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenFile(document)
                        }
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        เปิด
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(document)
                        }
                        className="rounded-lg bg-red-500 px-3 py-2 text-sm text-white hover:bg-red-600"
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* =========================
          Add Document Modal
      ========================= */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          if (!isSaving) {
            setIsModalOpen(false);
          }
        }}
      >
        <div className="w-full max-w-lg">
          <h2 className="mb-4 text-xl font-bold">
            เพิ่มเอกสาร
          </h2>

          {/* File input */}
          <div className="mb-4">
            <label className="mb-2 block text-sm font-medium">
              เลือกไฟล์
            </label>

            <input
              type="file"
              multiple
              onChange={handleFilesSelected}
              disabled={isSaving}
              className="block w-full rounded-lg border p-2 text-sm"
            />
          </div>

          {/* Selected files */}
          {attachedFiles.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 text-sm font-medium">
                ไฟล์ที่เลือก
              </p>

              <div className="space-y-2">
                {attachedFiles.map((attached, index) => (
                  <div
                    key={`${attached.file.name}-${index}`}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {attached.displayName}
                      </p>

                      <p className="text-xs text-gray-500">
                        {(attached.file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleRemoveAttachedFile(index)
                      }
                      disabled={isSaving}
                      className="ml-3 text-sm text-red-500 hover:text-red-700"
                    >
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsModalOpen(false);
                setAttachedFiles([]);
                setErrorMessage("");
              }}
              disabled={isSaving}
              className="rounded-lg border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={
                isSaving || attachedFiles.length === 0
              }
              className="rounded-lg bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}