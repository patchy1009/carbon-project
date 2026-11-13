import { redirect } from "next/navigation";

// หน้าแรกของเว็บ
export default function Home() {
  redirect("/organization/homepage");
}