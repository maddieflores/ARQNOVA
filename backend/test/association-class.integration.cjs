const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { XmiService } = require('../dist/xmi/xmi.service');

test('Venta-Producto-Detalle conserva AssociationClass en persistencia y round trip XMI', async () => {
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let projectId;
  let diagramId;
  let userId;
  let roleId;
  try {
    const role = await prisma.role.create({ data: { name: `TEST_${suffix}` } });
    roleId = role.id;
    const user = await prisma.user.create({ data: { name: 'Association Test', email: `association-${suffix}@test.local`, passwordHash: 'test', roleId } });
    userId = user.id;
    const project = await prisma.project.create({ data: { name: `Association ${suffix}`, ownerId: userId } });
    projectId = project.id;
    const diagram = await prisma.diagram.create({ data: { projectId, name: 'Venta-Producto' } });
    diagramId = diagram.id;
    const classes = await Promise.all([
      prisma.umlClass.create({ data: { diagramId: diagram.id, name: 'Vendedor', x: 0, y: 0 } }),
      prisma.umlClass.create({ data: { diagramId: diagram.id, name: 'Venta', x: 300, y: 0 } }),
      prisma.umlClass.create({ data: { diagramId: diagram.id, name: 'Producto', x: 600, y: 0 } }),
      prisma.umlClass.create({ data: { diagramId: diagram.id, name: 'Cliente', x: 300, y: 260 } }),
      prisma.umlClass.create({ data: {
        diagramId: diagram.id, name: 'Detalle', x: 450, y: 260,
        attributes: { create: [
          { name: 'cantidad', type: 'Integer', visibility: 'PRIVATE', position: 0 },
          { name: 'precioUnit', type: 'Decimal', visibility: 'PRIVATE', position: 1 },
        ] },
      } }),
    ]);
    const byName = new Map(classes.map(item => [item.name, item]));
    await prisma.umlRelation.createMany({ data: [
      { diagramId: diagram.id, sourceClassId: byName.get('Vendedor').id, targetClassId: byName.get('Venta').id, type: 'ASSOCIATION', sourceMultiplicity: '1', targetMultiplicity: '0..*' },
      { diagramId: diagram.id, sourceClassId: byName.get('Cliente').id, targetClassId: byName.get('Venta').id, type: 'ASSOCIATION', sourceMultiplicity: '1', targetMultiplicity: '0..*' },
      { diagramId: diagram.id, sourceClassId: byName.get('Venta').id, targetClassId: byName.get('Producto').id, associationClassId: byName.get('Detalle').id, type: 'ASSOCIATION', sourceMultiplicity: '1', targetMultiplicity: '*' },
    ] });
    const stored = await prisma.umlRelation.findMany({ where: { diagramId }, include: { associationClass: true } });
    const ventaProducto = stored.find(item => item.sourceClassId === byName.get('Venta').id && item.targetClassId === byName.get('Producto').id);
    assert.equal(stored.length, 3);
    assert.equal(ventaProducto.associationClass.name, 'Detalle');
    assert.equal(stored.filter(item => [item.sourceClassId, item.targetClassId].includes(byName.get('Detalle').id)).length, 0);

    const full = await prisma.diagram.findUniqueOrThrow({ where: { id: diagram.id }, include: { classes: { include: { attributes: true, methods: true } }, relations: true } });
    const exporter = new XmiService({}, { getOrCreateByProject: async () => full }, {});
    const exported = await exporter.export(projectId, userId);
    assert.match(exported.content, /xmi:type="uml:AssociationClass"/);
    assert.match(exported.content, /name="cantidad"/);
    assert.match(exported.content, /name="precioUnit"/);
    assert.doesNotMatch(exported.content, /xmi:type="uml:Class"[^>]*name="Detalle"/);

    const parser = new XmiService({}, {}, {});
    let parsed;
    try { parsed = parser.parse(exported.content); } catch (error) {
      console.error('PACKAGED', exported.content.match(/<packagedElement[^>]+>/g));
      throw error;
    }
    assert.equal(parsed.classes.find(item => item.name === 'Detalle').attributes.length, 2);
    assert.equal(parsed.relations.filter(item => item.sourceExternalId === `EAID_${byName.get('Venta').id.replaceAll('-', '_')}` && item.targetExternalId === `EAID_${byName.get('Producto').id.replaceAll('-', '_')}`).length, 1);
    const parsedAssociation = parsed.relations.find(item => item.associationClassExternalId);
    assert.equal(parsedAssociation.associationClassExternalId, `EAID_${byName.get('Detalle').id.replaceAll('-', '_')}`);
    assert.equal(parsedAssociation.targetMultiplicity, '*');
  } finally {
    if (diagramId) await prisma.diagram.delete({ where: { id: diagramId } });
    if (projectId) await prisma.project.delete({ where: { id: projectId } });
    if (userId) await prisma.user.delete({ where: { id: userId } });
    if (roleId) await prisma.role.delete({ where: { id: roleId } });
    await prisma.$disconnect();
  }
});
