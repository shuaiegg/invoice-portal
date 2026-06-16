"use client";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh(); // Ensure session state is cleared
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className={className || "text-gray-500 hover:text-gray-700 text-sm font-medium"}
    >
      Logout
    </button>
  );
}
