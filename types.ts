
export interface ScannedDocument {
  id: string;
  name: string; // Ex: Identidade, CPF
  type: string; // Ex: image/jpeg
  url: string; // Base64
  date: string;
  tags?: string[];
}

export interface AgendaEvent {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  type: 'audiência' | 'perícia' | 'atendimento' | 'prazo' | 'outro';
  clientId?: string;
  clientName?: string;
  description: string;
  location?: string;
  status?: 'pending' | 'resolved' | 'cancelled';
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
  isVirtual?: boolean;
}

export interface Petition {
  id: string;
  title: string;
  content: string;
  category: string;
  type: 'model' | 'concrete';
  lastModified: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  cpf: string;
  password: string;
  nationality?: string;
  maritalStatus?: string;
  profession?: string;
  type: string;
  der: string;
  medExpertiseDate: string;
  socialExpertiseDate: string;
  extensionDate: string;
  dcbDate: string;
  ninetyDaysDate: string;
  securityMandateDate: string;
  address?: string;
  
  // Campos do Representante Legal
  legalRepresentative?: string; // Nome
  legalRepresentativeCpf?: string;
  legalRepresentativeMaritalStatus?: string;
  legalRepresentativeProfession?: string;
  legalRepresentativeAddress?: string;

  isDailyAttention?: boolean;
  isUrgentAttention?: boolean;
  isArchived?: boolean;
  isReferral?: boolean;
  referrerName?: string;
  referrerPercentage?: number;
  totalFee?: number;
  documents?: ScannedDocument[];
  documentCount?: number;
  petitions?: Petition[];
}

export enum UserRole {
  ADVOGADO = 'Advogado(a)',
  SECRETARIA = 'Secretária'
}

export interface User {
  firstName: string;
  lastName: string;
  role: UserRole;
  email?: string | null;
}

export const AUTHORIZED_USERS = [
  { firstName: 'Michel', lastName: 'Felix', role: UserRole.ADVOGADO },
  { firstName: 'Luana', lastName: 'Castro', role: UserRole.ADVOGADO },
  { firstName: 'Fabrícia', lastName: 'Sousa', role: UserRole.SECRETARIA },
];

export interface FocusTask {
  id: string;
  title: string;
  description: string;
  type: 'alert' | 'contract' | 'postponed';
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  clientId?: string;
  clientName?: string;
  originalAlertKey?: string;
}

export interface TaskLogEntry {
  id: string;
  taskId: string;
  title: string;
  action: 'completed' | 'discarded';
  completedAt: string;
  completedBy: string;
}

export interface DailyFocusState {
  resolvedTasks: string[];
  postponedTasks: FocusTask[];
  taskLog: TaskLogEntry[];
}

// --- NOVOS TIPOS PARA CONTRATOS ---

export interface PaymentEntry {
  id: string;
  date: string; // ISO Date YYYY-MM-DD
  dueDate: string; // ISO Date YYYY-MM-DD
  amount: number;
  isPaid: boolean;
  note?: string;
}

export interface ContractRecord {
  id: string;
  clientId?: string;
  firstName: string;
  lastName: string;
  cpf: string;
  serviceType: string;
  lawyer: 'Michel' | 'Luana';
  totalFee: number;
  status: 'Pendente' | 'Em Andamento' | 'Concluído';
  paymentMethod: 'À Vista' | 'Parcelado';
  installmentsCount?: number; // Novo campo para quantidade de parcelas
  payments: PaymentEntry[];
  createdAt: string;
}

// --- Interfaces de Componentes (Movidas do App.tsx) ---

export interface NotificationItem {
  id: string;
  clientName: string;
  type: string;
  date: string;
}

export interface ContractModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: ContractRecord) => void;
  initialData?: ContractRecord | null;
  clients: ClientRecord[];
}

export interface LoginProps {
  onLogin: (user: User) => void;
  onOpenSettings: () => void;
  isCloudConfigured: boolean;
}

export interface RecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: ClientRecord) => void;
  initialData?: ClientRecord | null;
  onOpenScanner?: () => void;
  onOpenPetition?: (petition: Petition, clientId?: string) => void;
}

export interface MonthlyDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    year: number;
    contracts: ContractRecord[];
    type: 'revenue' | 'michel' | 'luana' | 'portfolio' | 'total_concluded' | null;
}

export interface DashboardProps {
  user: User;
  onLogout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onOpenSettings: () => void;
  isCloudConfigured: boolean;
  isSettingsOpen: boolean;
  onCloseSettings: () => void;
  onSettingsSaved: () => void;
  onRestoreBackup: () => void;
}

export interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (doc: ScannedDocument) => void;
}
