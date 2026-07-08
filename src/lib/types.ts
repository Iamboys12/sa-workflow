export type UserRole = 'sa' | 'pm' | 'tech_lead'
export type ProjectStatus = 'active' | 'completed' | 'archived'
export type StepStatus = 'not_started' | 'in_progress' | 'blocked' | 'done'
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type CollaborationModel = 'human-led' | 'ai-assisted' | 'paired'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  created_at: string
}

export interface WorkflowTemplate {
  id: string
  name: string
  is_default: boolean
  created_by: string | null
  created_at: string
}

export interface WorkflowTemplateStep {
  id: string
  template_id: string
  order: number
  title: string
  collaboration_model: CollaborationModel
  deliverables: string[]
}

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  created_by: string
  template_id: string | null
  created_at: string
}

export interface ProjectMember {
  project_id: string
  user_id: string
  role: UserRole
}

export interface ProjectStep {
  id: string
  project_id: string
  template_step_id: string | null
  status: StepStatus
  order: number
  updated_at: string
  // joined / computed
  template_step?: WorkflowTemplateStep
  task_count?: number
  done_count?: number
}

export interface Task {
  id: string
  project_step_id: string
  title: string
  description: string
  assigned_to: string | null
  status: TaskStatus
  due_date: string | null
  created_by: string
  created_at: string
  updated_at: string
  // joined
  assignee?: Profile
}

export interface Notification {
  id: string
  user_id: string
  type: string
  payload: Record<string, unknown>
  read: boolean
  created_at: string
}

// Composite view types used in UI
export interface ProjectWithSteps extends Project {
  steps: ProjectStep[]
  members: (ProjectMember & { profile: Profile })[]
}

export interface StepWithTasks extends ProjectStep {
  tasks: Task[]
}

export type TaskEventType = 'comment' | 'status_change' | 'assigned' | 'due_date_set'

export interface TaskEvent {
  id: string
  task_id: string
  user_id: string
  user_name: string
  type: TaskEventType
  body: string | null
  meta: Record<string, unknown> | null
  created_at: string
}
