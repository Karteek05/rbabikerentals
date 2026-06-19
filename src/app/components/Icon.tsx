import {
  MapPin,
  Phone,
  MessageSquare,
  Mail,
  Gift,
  Bike,
  Zap,
  IdCard,
  CheckCircle,
  ShieldCheck,
  Wrench,
  LifeBuoy,
  IndianRupee,
  BarChart3,
  Settings,
  List,
  Search,
  RefreshCw,
  Home,
  FileText,
  AlertTriangle,
  X,
  Sparkles,
  Clock,
  Calendar,
  Briefcase,
  type LucideIcon,
  type LucideProps,
  UserPlus
} from "lucide-react";

export type IconName =
  | "location"
  | "phone"
  | "chat"
  | "mail"
  | "gift"
  | "scooter"
  | "bike"
  | "ev"
  | "idCard"
  | "checkCircle"
  | "shield"
  | "wrench"
  | "support"
  | "money"
  | "chart"
  | "settings"
  | "list"
  | "search"
  | "refresh"
  | "home"
  | "document"
  | "warning"
  | "close"
  | "spark"
  | "clock"
  | "calendar"
  | "briefcase"
  | "user-plus";

interface IconProps extends LucideProps {
  name: IconName;
}

const iconMap: Record<IconName, LucideIcon> = {
  location: MapPin,
  phone: Phone,
  chat: MessageSquare,
  mail: Mail,
  gift: Gift,
  scooter: Bike, // Fallback to Bike
  bike: Bike,
  ev: Zap, // Zap for EV
  idCard: IdCard,
  checkCircle: CheckCircle,
  shield: ShieldCheck,
  wrench: Wrench,
  support: LifeBuoy,
  money: IndianRupee,
  chart: BarChart3,
  settings: Settings,
  list: List,
  search: Search,
  refresh: RefreshCw,
  home: Home,
  document: FileText,
  warning: AlertTriangle,
  close: X,
  spark: Sparkles,
  clock: Clock,
  calendar: Calendar,
  briefcase: Briefcase,
  "user-plus": UserPlus,
};

export default function Icon({ name, className, ...props }: IconProps) {
  const LucideComponent = iconMap[name];
  if (!LucideComponent) return null;
  return <LucideComponent className={className} {...props} />;
}
