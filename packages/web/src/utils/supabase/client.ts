import { createBrowserClient } from "@supabase/ssr";

export const createClientSide = () => {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
};

// Helper function for storage operations (client-side)
export const getStorageClient = () => {
  const supabase = createClientSide();
  return supabase.storage;
};

// File storage functions
export const uploadLogFile = async (file: File, userId: string) => {
  const supabase = createClientSide();

  try {
    const fileName = `${userId}/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from("log-files")
      .upload(fileName, file, {
        upsert: true,
      });

    if (error) throw error;

    return {
      success: true,
      filePath: data.path,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      jobId: data.path,
      fullPath: supabase.storage.from("log-files").getPublicUrl(data.path).data
        .publicUrl,
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

export const getFileUrl = (filePath: string) => {
  const supabase = createClientSide();
  return supabase.storage.from("log-files").getPublicUrl(filePath).data
    .publicUrl;
};

export const downloadLogFile = async (filePath: string) => {
  const supabase = createClientSide();
  const { data, error } = await supabase.storage
    .from("log-files")
    .download(filePath);

  if (error) throw error;
  return data;
};

export const deleteLogFile = async (filePath: string) => {
  const supabase = createClientSide();
  const { error } = await supabase.storage.from("log-files").remove([filePath]);

  if (error) throw error;
  return { success: true };
};
