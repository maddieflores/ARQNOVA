ALTER TABLE "UmlRelation" ADD COLUMN "associationClassId" UUID;

CREATE UNIQUE INDEX "UmlRelation_associationClassId_key" ON "UmlRelation"("associationClassId");

ALTER TABLE "UmlRelation" ADD CONSTRAINT "UmlRelation_associationClassId_fkey"
FOREIGN KEY ("associationClassId") REFERENCES "UmlClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;
