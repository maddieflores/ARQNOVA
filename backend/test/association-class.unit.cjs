const test = require('node:test');
const assert = require('node:assert/strict');
const { XmiService } = require('../dist/xmi/xmi.service');
const { AiUmlProposalService } = require('../dist/ai/ai-uml-proposal.service');

test('AssociationClass se conserva en el parser XMI sin crear dos asociaciones', () => {
  const service = new XmiService({}, {}, {});
  const xml = `<?xml version="1.0"?><xmi:XMI xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.eclipse.org/uml2/5.0.0/UML" xmi:version="2.5.1"><uml:Model xmi:type="uml:Model" xmi:id="m" name="Venta"><packagedElement xmi:type="uml:Class" xmi:id="venta" name="Venta"/><packagedElement xmi:type="uml:Class" xmi:id="producto" name="Producto"/><packagedElement xmi:type="uml:AssociationClass" xmi:id="detalle" name="Detalle"><ownedAttribute xmi:type="uml:Property" xmi:id="cantidad" name="cantidad" type="String"/><ownedAttribute xmi:type="uml:Property" xmi:id="precio" name="precioUnit" type="Decimal"/><ownedEnd xmi:type="uml:Property" xmi:id="e1" type="venta"><lowerValue xmi:type="uml:LiteralInteger" value="1"/><upperValue xmi:type="uml:LiteralInteger" value="1"/></ownedEnd><ownedEnd xmi:type="uml:Property" xmi:id="e2" type="producto"><lowerValue xmi:type="uml:LiteralInteger" value="0"/><upperValue xmi:type="uml:LiteralUnlimitedNatural" value="-1"/></ownedEnd></packagedElement></uml:Model></xmi:XMI>`;
  const model = service.parse(xml);
  assert.deepEqual(model.classes.map(item => item.name), ['Venta', 'Producto', 'Detalle']);
  assert.deepEqual(model.classes.find(item => item.name === 'Detalle').attributes.map(item => item.name), ['cantidad', 'precioUnit']);
  assert.equal(model.relations.length, 1);
  assert.equal(model.relations[0].sourceExternalId, 'venta');
  assert.equal(model.relations[0].targetExternalId, 'producto');
  assert.equal(model.relations[0].associationClassExternalId, 'detalle');
});

test('La propuesta de IA acepta associationClassName y mantiene una sola relación', () => {
  const service = new AiUmlProposalService({ generateUmlProposal: async () => ({}) }, { get: () => 1000 });
  const proposal = service.parse({ classes: [
    { name: 'Venta', attributes: [], methods: [] },
    { name: 'Producto', attributes: [], methods: [] },
    { name: 'Detalle', attributes: [{ name: 'cantidad', type: 'Integer', visibility: 'PRIVATE' }, { name: 'precioUnit', type: 'Decimal', visibility: 'PRIVATE' }], methods: [] },
  ], relations: [{ sourceClassName: 'Venta', targetClassName: 'Producto', type: 'ASSOCIATION', sourceMultiplicity: '1', targetMultiplicity: '0..*', associationClassName: 'Detalle' }] });
  assert.equal(proposal.relations.length, 1);
  assert.equal(proposal.relations[0].associationClassName, 'Detalle');
});

test('El exportador emite uml:AssociationClass y no un uml:Class separado', async () => {
  const diagram = {
    id: 'd', name: 'Venta', classes: [
      { id: 'v', name: 'Venta', x: 0, y: 0, width: null, height: null, isAbstract: false, attributes: [], methods: [] },
      { id: 'p', name: 'Producto', x: 400, y: 0, width: null, height: null, isAbstract: false, attributes: [], methods: [] },
      { id: 'a', name: 'Detalle', x: 200, y: 250, width: null, height: null, isAbstract: false, attributes: [{ id: 'q', name: 'cantidad', type: 'Integer', visibility: 'PRIVATE', isPrimaryKey: false }], methods: [] },
    ],
    relations: [{ id: 'r', sourceClassId: 'v', targetClassId: 'p', associationClassId: 'a', type: 'ASSOCIATION', sourceMultiplicity: '1', targetMultiplicity: '0..*', label: null }],
  };
  const service = new XmiService({}, { getOrCreateByProject: async () => diagram }, {});
  const result = await service.export('p', 'u');
  assert.match(result.content, /xmi:type="uml:AssociationClass"/);
  assert.match(result.content, /name="Detalle"/);
  assert.doesNotMatch(result.content, /xmi:type="uml:Class" xmi:id="EAID_a"/);
});
