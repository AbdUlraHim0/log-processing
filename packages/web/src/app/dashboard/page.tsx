import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";
import { createServerSide } from "@/utils/supabase/server";

export default async function Dashboard() {
  console.log("Dashboard: Starting server-side rendering");

  const supabase = await createServerSide();

  console.log("Dashboard: Supabase client created");

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  console.log("Dashboard: Auth check completed", !!user);

  if (error || !user) {
    redirect("/auth/signin");
  }

  return <DashboardClient user={user} />;
}
