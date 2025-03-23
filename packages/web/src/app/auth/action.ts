"use server";

import { createServerSide } from "@/utils/supabase/server";
import { redirect } from "next/navigation";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createServerSide();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return redirect("/auth/signin?error=" + encodeURIComponent(error.message));
  }

  return redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createServerSide();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${
        process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
      }/auth/callback`,
    },
  });

  if (error) {
    return redirect("/auth/signup?error=" + encodeURIComponent(error.message));
  }

  return redirect("/auth/confirmation");
}

export async function signout() {
  const supabase = await createServerSide();
  await supabase.auth.signOut();
  return redirect("/");
}
