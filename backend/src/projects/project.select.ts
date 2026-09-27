import { Prisma } from '@prisma/client';

export const PROJECT_SELECT = {
  id: true,
  name: true,
  description: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  owner: { select: { id: true, name: true, email: true } },
  members: {
    select: {
      id: true,
      userId: true,
      joinedAt: true,
      user: { select: { id: true, name: true, email: true } },
    },
  },
  diagrams: {
    select: {
      id: true,
      name: true,
      _count: { select: { classes: true, relations: true } },
    },
  },
} satisfies Prisma.ProjectSelect;

export const PROJECT_MEMBER_SELECT = {
  id: true,
  projectId: true,
  userId: true,
  joinedAt: true,
  user: { select: { id: true, name: true, email: true, isActive: true, role: { select: { id: true, name: true } } } },
} satisfies Prisma.ProjectMemberSelect;
