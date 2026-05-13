import Link from "next/link";
import { MdLogout } from "react-icons/md";

import { signOut } from "@/lib/actions/auth";

interface Props {
  displayName: string;
}

export function DashboardTopbar({ displayName }: Props) {
  const initials = (displayName || "S")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="border-divider bg-primary-contr flex h-16 shrink-0 items-center justify-between gap-3 border-b px-6">
      <Link href="/" aria-label="InLecture home" className="flex items-center">
        <img src="/InLectureLogoWithIcon.svg" alt="InLecture" className="h-7" />
      </Link>
      <div className="flex items-center gap-3">
        <div className="bg-primary-tint text-primary-accent-dark flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold">
          {initials}
        </div>
        <span className="text-primary hidden text-sm font-medium sm:inline">
          {displayName}
        </span>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sign out"
            className="text-secondary hover:text-primary-accent flex h-8 w-8 items-center justify-center rounded-full transition"
          >
            <MdLogout className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
