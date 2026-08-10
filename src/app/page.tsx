/*
export default function Home() {
  return (
    <>
      <header className="bg-blue-300 p-10"> 
        <nav className="flex gap-10">
          <a>Dashboard</a>
          <a>Profile</a>
          <a>Logout</a>
        </nav>
      </header>
      <main className="flex min-h-screen items-center justify-center">
        <h1 className="text-5xl font-bold text-green-600">
          Carbon Project is the Last!!
        </h1>
      </main>
      <footer className="p-10 text-center bg-blue-300">
        <p>
          Carbon Project is the Last!!
        </p>
      </footer>
    </>
  );
}
*/
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/admin/dashboard");
}