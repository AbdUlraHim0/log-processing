// Only import and use this file in the app directory components
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerSide() {
  const cookieStore = await cookies();
  console.log("Creating server-side Supabase client");
  console.log(
    `Supabase URL available: ${!!process.env.NEXT_PUBLIC_SUPABASE_URL}`
  );
  console.log(
    `Supabase key available: ${!!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
  );

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );
}

// These functions should only be used in server components in the app directory
export const getServerStorageClient = async () => {
  const supabase = await createServerSide();
  return supabase.storage;
};

export const getServerFileUrl = async (filePath: string) => {
  const supabase = await createServerSide();
  return supabase.storage.from("log-files").getPublicUrl(filePath).data
    .publicUrl;
};

export const downloadServerLogFile = async (filePath: string) => {
  const supabase = await createServerSide();
  const { data, error } = await supabase.storage
    .from("log-files")
    .download(filePath);

  if (error) throw error;
  return data;
};

export const deleteServerLogFile = async (filePath: string) => {
  const supabase = await createServerSide();
  const { error } = await supabase.storage.from("log-files").remove([filePath]);

  if (error) throw error;
  return { success: true };
};
