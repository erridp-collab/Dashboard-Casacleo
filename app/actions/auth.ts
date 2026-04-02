"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function loginAction(prevState: any, formData: FormData) {
  const password = formData.get("password")?.toString();
  const envPassword = process.env.APP_PASSWORD;

  if (!envPassword) {
    return { error: "Variabile di ambiente APP_PASSWORD non configurata nel server" };
  }

  if (password === envPassword) {
    // Generate a simple token to verify (just a predefined static word for shared auth)
    // You could also use a JWT in a more complex setup
    const cookieStore = await cookies();
    cookieStore.set("auth-token", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    redirect("/");
  } else {
    return { error: "Password errata" };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("auth-token");
  redirect("/login");
}
