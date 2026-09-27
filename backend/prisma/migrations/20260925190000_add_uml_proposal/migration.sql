-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'APPLIED', 'REJECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "ProposalOrigin" AS ENUM ('MOBILE_IMAGE', 'WEB_AI');

-- CreateTable
CREATE TABLE "UmlProposal" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "origin" "ProposalOrigin" NOT NULL DEFAULT 'MOBILE_IMAGE',
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "prompt" TEXT,
    "summary" TEXT,
    "classesCount" INTEGER NOT NULL DEFAULT 0,
    "attributesCount" INTEGER NOT NULL DEFAULT 0,
    "methodsCount" INTEGER NOT NULL DEFAULT 0,
    "relationsCount" INTEGER NOT NULL DEFAULT 0,
    "proposalJson" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UmlProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UmlProposal_projectId_status_idx" ON "UmlProposal"("projectId", "status");

-- CreateIndex
CREATE INDEX "UmlProposal_userId_idx" ON "UmlProposal"("userId");

-- AddForeignKey
ALTER TABLE "UmlProposal" ADD CONSTRAINT "UmlProposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UmlProposal" ADD CONSTRAINT "UmlProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
