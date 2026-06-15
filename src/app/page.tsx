import { redirect } from "next/navigation";

/** The shell opens on the overview dashboard. */
export default function RootPage() {
  redirect("/overview");
}
