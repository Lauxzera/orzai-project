import "server-only";
import { getPrismaClient } from "@/lib/server/crm/prisma-store";
import { FollowUpStatus } from "@/lib/generated/prisma/client";
import { addDays } from "date-fns";
import { createLogger } from "@/lib/server/logger";

const logger = createLogger("reengagement");

export async function scheduleFollowUp(leadId: string, departmentId: string) {
  const prisma = getPrismaClient();
  
  // Schedule for 24h from now
  const scheduledFor = addDays(new Date(), 1);
  
  try {
    const followUp = await prisma.scheduledFollowUp.create({
      data: {
        leadId,
        departmentId,
        scheduledFor,
        status: FollowUpStatus.PENDING,
      },
    });
    
    logger.info(`Scheduled follow-up for lead`, { leadId, scheduledFor: scheduledFor.toISOString() });
    return followUp;
  } catch (error) {
    logger.error("Error scheduling follow-up", error, { leadId });
    throw error;
  }
}

export async function cancelPendingFollowUps(leadId: string) {
  const prisma = getPrismaClient();
  
  try {
    const result = await prisma.scheduledFollowUp.updateMany({
      where: {
        leadId,
        status: FollowUpStatus.PENDING,
      },
      data: {
        status: FollowUpStatus.CANCELLED,
      },
    });
    
    if (result.count > 0) {
      logger.info(`Cancelled pending follow-ups`, { leadId, count: result.count });
    }
    
    return result;
  } catch (error) {
    logger.error("Error cancelling pending follow-ups", error, { leadId });
    throw error;
  }
}

export async function cancelPendingFollowUpsByPhone(phone: string) {
  const prisma = getPrismaClient();
  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { telefone: phone },
        { whatsapp: phone }
      ]
    },
    select: { id: true }
  });

  for (const lead of leads) {
    await cancelPendingFollowUps(lead.id);
  }
}

export async function scheduleFollowUpByPhone(phone: string, departmentId?: string | null) {
  const prisma = getPrismaClient();
  const leads = await prisma.lead.findMany({
    where: {
      OR: [
        { telefone: phone },
        { whatsapp: phone }
      ]
    },
    select: { id: true, departmentId: true }
  });

  for (const lead of leads) {
    const depId = departmentId || lead.departmentId;
    if (depId) {
      // Cancel existing before scheduling a new one
      await cancelPendingFollowUps(lead.id);
      await scheduleFollowUp(lead.id, depId);
    }
  }
}
