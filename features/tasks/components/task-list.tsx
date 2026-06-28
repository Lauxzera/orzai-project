"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/features/app-shell/components/page-primitives";
import { formatDate, taskOverdue, type Lead, type Task } from "@/lib/crm";

type Props = {
  leads: Lead[];
  tasks: Task[];
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
  canEdit: boolean;
};

export function TaskList({ leads, tasks, onOpen, onToggle, canEdit }: Props) {
  if (!tasks.length) return <EmptyState text="Nenhuma tarefa encontrada." />;

  return (
    <div className="grid gap-3">
      {tasks.map((task) => {
        const lead = leads.find((item) => item.id === task.leadId);
        return (
          <Card key={task.id} >
            <CardContent className="grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center">
              <div>
                <h3 className="font-semibold">{task.title}</h3>
                <p className="text-sm text-muted-foreground">{lead?.nome || "Lead removido"}</p>
              </div>
              <p className="text-sm text-muted-foreground">{task.owner}</p>
              <Badge variant={task.done ? "success" : taskOverdue(task) ? "danger" : "gold"}>
                {task.done ? "Concluída" : taskOverdue(task) ? "Atrasada" : formatDate(task.dueDate)}
              </Badge>
              <div className="flex gap-2">
                {canEdit ?<Button size="sm" variant="outline" onClick={() => onToggle(task.id)}>{task.done ? "Reabrir" : "Concluir"}</Button> : null}
                {lead ?<Button size="sm" variant="muted" onClick={() => onOpen(lead.id)}>Lead</Button> : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
