const { test } = require('node:test');
const assert = require('node:assert/strict');
require('reflect-metadata');
const { AiUmlProposalService } = require('../dist/ai/ai-uml-proposal.service');

const service = response => new AiUmlProposalService(
  { generateUmlProposal: async () => response },
  { get: (_key, fallback) => fallback },
);

test('normaliza aliases de atributos y métodos anidados sin alterar campos correctos', async () => {
  const proposal = await service({
    summary: 'Clase normalizada',
    actions: [{
      action: 'ADD_CLASS',
      className: 'Persona',
      attributes: [{
        attributeName: 'nombre',
        attributeType: 'String',
        attributeVisibility: 'PRIVATE',
        isPrimaryKey: false,
      }],
      methods: [{
        methodName: 'saludar',
        methodReturnType: 'String',
        methodVisibility: 'PUBLIC',
      }],
    }],
    classes: [{
      name: 'Correcta',
      attributes: [{ name: 'id', type: 'UUID', visibility: 'PRIVATE' }],
      methods: [{ name: 'crear', returnType: 'void', visibility: 'PUBLIC' }],
    }],
  }).generate('modelo');

  assert.deepEqual({ ...proposal.actions[0].attributes[0] }, {
    name: 'nombre', type: 'String', visibility: 'PRIVATE', isPrimaryKey: false,
  });
  assert.deepEqual({ ...proposal.actions[0].methods[0] }, {
    name: 'saludar', returnType: 'String', visibility: 'PUBLIC',
  });
  assert.deepEqual({ ...proposal.classes[0].attributes[0] }, {
    name: 'id', type: 'UUID', visibility: 'PRIVATE', isPrimaryKey: undefined,
  });
});
