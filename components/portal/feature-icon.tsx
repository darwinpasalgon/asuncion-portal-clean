import {
  BarChart3,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  MessageCircle,
  Megaphone,
  Settings2,
  ShieldCheck,
  Upload,
  UserRound,
  Users,
} from "lucide-react";

const icons = {
  home: LayoutDashboard,
  book: BookOpen,
  briefcase: BriefcaseBusiness,
  calendar: CalendarDays,
  attendance: ClipboardCheck,
  forms: FileSpreadsheet,
  chart: BarChart3,
  check: CheckCircle2,
  folder: FolderOpen,
  grades: GraduationCap,
  message: MessageCircle,
  megaphone: Megaphone,
  settings: Settings2,
  shield: ShieldCheck,
  import: Upload,
  user: UserRound,
  users: Users,
  students: GraduationCap,
};
export default function FeatureIcon({
  name,
  size = 19,
}: {
  name: string;
  size?: number;
}) {
  const Icon = icons[name as keyof typeof icons] ?? BookOpen;
  return <Icon size={size} aria-hidden="true" />;
}
