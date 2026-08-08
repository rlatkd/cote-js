import type { Metadata } from "next";
import SettingsView from "./SettingsView";

export const metadata: Metadata = {
  title: "설정",
  robots: { index: false, follow: true },
};

export default function SettingsPage() {
  return <SettingsView />;
}
