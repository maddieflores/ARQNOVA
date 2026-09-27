import { Injectable } from '@nestjs/common';
import type { AiImageInput, AiProvider } from './ai-provider';

@Injectable()
export class MockAiProvider implements AiProvider {
  async generateUmlProposal(prompt: string, currentDiagram?: any, image?: AiImageInput) {
    const lower = (prompt || '').toLowerCase();

    // Caso: Análisis visual mediante Imagen / Foto
    if (image || lower.includes('imagen') || lower.includes('foto')) {
      const existingCliente = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'cliente');
      const existingPedido = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'pedido');

      if (existingCliente && !existingPedido) {
        // Modo incremental con imagen: solo agregar clase faltante y relación
        return {
          summary: 'Análisis de imagen: Incorporar clase Pedido y relación desde Cliente',
          actions: [
            {
              action: 'ADD_CLASS',
              className: 'Pedido',
              attributes: [
                { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
                { name: 'total', type: 'Decimal', visibility: 'PRIVATE' },
              ],
              methods: [],
            },
            {
              action: 'ADD_RELATION',
              sourceClassId: existingCliente.id,
              sourceClassName: 'Cliente',
              targetClassName: 'Pedido',
              relationType: 'ASSOCIATION',
              sourceMultiplicity: '1',
              targetMultiplicity: '0..*',
            },
          ],
        };
      }

      if (existingCliente && existingPedido) {
        // Clases ya existen: no duplicar
        return {
          summary: 'Análisis de imagen: Las clases Cliente y Pedido ya existen en el modelo actual.',
          actions: [],
        };
      }

      // Crear desde cero a partir de la imagen
      return {
        summary: 'Análisis de imagen UML: Diagrama identificado con Cliente, Pedido y relación 1 a 0..*',
        actions: [
          {
            action: 'ADD_CLASS',
            className: 'Cliente',
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'nombre', type: 'String', visibility: 'PRIVATE' },
            ],
            methods: [],
          },
          {
            action: 'ADD_CLASS',
            className: 'Pedido',
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'total', type: 'Decimal', visibility: 'PRIVATE' },
            ],
            methods: [],
          },
          {
            action: 'ADD_RELATION',
            sourceClassName: 'Cliente',
            targetClassName: 'Pedido',
            relationType: 'ASSOCIATION',
            sourceMultiplicity: '1',
            targetMultiplicity: '0..*',
          },
        ],
      };
    }


    // Caso: Agregar atributo
    if (lower.includes('agrega telefono') || lower.includes('agregar telefono') || (lower.includes('telefono') && lower.includes('cliente'))) {
      const clienteClass = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'cliente');
      return {
        summary: 'Agregar atributo telefono de tipo String a la clase Cliente',
        actions: [
          {
            action: 'ADD_ATTRIBUTE',
            classId: clienteClass?.id,
            className: 'Cliente',
            attributeName: 'telefono',
            attributeType: 'String',
            attributeVisibility: 'PRIVATE',
            isPrimaryKey: false,
          },
        ],
      };
    }

    // Caso: Modificar atributo
    if (lower.includes('cambia el tipo de telefono') || (lower.includes('telefono') && lower.includes('long'))) {
      const clienteClass = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'cliente');
      const telefonoAttr = clienteClass?.attributes?.find((a: any) => a.name?.toLowerCase() === 'telefono');
      return {
        summary: 'Modificar tipo de telefono a Long en la clase Cliente',
        actions: [
          {
            action: 'UPDATE_ATTRIBUTE',
            attributeId: telefonoAttr?.id,
            classId: clienteClass?.id,
            className: 'Cliente',
            attributeName: 'telefono',
            attributeType: 'Long',
          },
        ],
      };
    }

    // Caso: Eliminar atributo
    if (lower.includes('elimina telefono') || lower.includes('eliminar telefono')) {
      const clienteClass = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'cliente');
      const telefonoAttr = clienteClass?.attributes?.find((a: any) => a.name?.toLowerCase() === 'telefono');
      return {
        summary: 'Eliminar atributo telefono de la clase Cliente',
        actions: [
          {
            action: 'DELETE_ATTRIBUTE',
            attributeId: telefonoAttr?.id,
            classId: clienteClass?.id,
            className: 'Cliente',
            attributeName: 'telefono',
          },
        ],
      };
    }

    // Caso: Renombrar clase
    if (lower.includes('cambia cliente a usuario') || lower.includes('renombra cliente') || lower.includes('usuario')) {
      const clienteClass = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'cliente');
      return {
        summary: 'Renombrar clase Cliente a Usuario',
        actions: [
          {
            action: 'UPDATE_CLASS',
            classId: clienteClass?.id,
            className: 'Usuario',
          },
        ],
      };
    }

    // Caso: Agregar método
    if (lower.includes('calculartotal') || lower.includes('calcular total')) {
      const pedidoClass = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'pedido');
      return {
        summary: 'Agregar método calcularTotal(): Decimal a la clase Pedido',
        actions: [
          {
            action: 'ADD_METHOD',
            classId: pedidoClass?.id,
            className: 'Pedido',
            methodName: 'calcularTotal',
            methodReturnType: 'Decimal',
            methodVisibility: 'PUBLIC',
          },
        ],
      };
    }

    // Caso: Modificar método
    if (lower.includes('modificar calculartotal') || lower.includes('cambia calculartotal')) {
      const pedidoClass = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'pedido');
      const method = pedidoClass?.methods?.find((m: any) => m.name?.toLowerCase() === 'calculartotal');
      return {
        summary: 'Modificar método calcularTotal(): void a la clase Pedido',
        actions: [
          {
            action: 'UPDATE_METHOD',
            methodId: method?.id,
            classId: pedidoClass?.id,
            className: 'Pedido',
            methodName: 'calcularTotal',
            methodReturnType: 'void',
          },
        ],
      };
    }

    // Caso: Eliminar método
    if (lower.includes('elimina calculartotal') || lower.includes('eliminar calculartotal')) {
      const pedidoClass = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'pedido');
      const method = pedidoClass?.methods?.find((m: any) => m.name?.toLowerCase() === 'calculartotal');
      return {
        summary: 'Eliminar método calcularTotal de la clase Pedido',
        actions: [
          {
            action: 'DELETE_METHOD',
            methodId: method?.id,
            classId: pedidoClass?.id,
            className: 'Pedido',
            methodName: 'calcularTotal',
          },
        ],
      };
    }

    // Caso: Modificar multiplicidad / relación
    if (lower.includes('multiplicidad') || lower.includes('0..*')) {
      const clienteClass = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'cliente');
      const pedidoClass = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'pedido');
      const rel = currentDiagram?.relations?.find((r: any) => 
        (r.sourceClassId === clienteClass?.id && r.targetClassId === pedidoClass?.id) ||
        (r.sourceClassId === pedidoClass?.id && r.targetClassId === clienteClass?.id)
      );
      return {
        summary: 'Actualizar multiplicidad de relación a 0..*',
        actions: [
          {
            action: 'UPDATE_RELATION',
            relationId: rel?.id,
            sourceClassId: clienteClass?.id,
            targetClassId: pedidoClass?.id,
            sourceClassName: 'Cliente',
            targetClassName: 'Pedido',
            targetMultiplicity: '0..*',
          },
        ],
      };
    }

    // Caso: Eliminar relación
    if (lower.includes('elimina relacion') || lower.includes('eliminar relacion')) {
      const clienteClass = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'cliente');
      const pedidoClass = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'pedido');
      const rel = currentDiagram?.relations?.find((r: any) => 
        (r.sourceClassId === clienteClass?.id && r.targetClassId === pedidoClass?.id) ||
        (r.sourceClassId === pedidoClass?.id && r.targetClassId === clienteClass?.id)
      );
      return {
        summary: 'Eliminar relación entre Cliente y Pedido',
        actions: [
          {
            action: 'DELETE_RELATION',
            relationId: rel?.id,
            sourceClassId: clienteClass?.id,
            targetClassId: pedidoClass?.id,
          },
        ],
      };
    }

    // Caso: Agregar clase Producto
    if (lower.includes('producto') && !lower.includes('cliente')) {
      return {
        summary: 'Crear clase Producto con atributos id, nombre, precio',
        actions: [
          {
            action: 'ADD_CLASS',
            className: 'Producto',
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'nombre', type: 'String', visibility: 'PRIVATE' },
              { name: 'precio', type: 'Decimal', visibility: 'PRIVATE' },
            ],
            methods: [],
          },
        ],
      };
    }

    // Caso: Eliminar clase
    if (lower.includes('elimina producto') || lower.includes('eliminar producto')) {
      const prodClass = currentDiagram?.classes?.find((c: any) => c.name?.toLowerCase() === 'producto');
      return {
        summary: 'Eliminar clase Producto',
        actions: [
          {
            action: 'DELETE_CLASS',
            classId: prodClass?.id,
            className: 'Producto',
          },
        ],
      };
    }

    // Respuesta determinista por defecto para compatibilidad total con tests existentes
    return JSON.stringify({
      classes: [
        { name: 'Cliente', attributes: [{ name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true }, { name: 'nombre', type: 'String', visibility: 'PRIVATE' }, { name: 'correo', type: 'String', visibility: 'PRIVATE' }], methods: [] },
        { name: 'Pedido', attributes: [{ name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true }, { name: 'fecha', type: 'Date', visibility: 'PRIVATE' }, { name: 'total', type: 'Decimal', visibility: 'PRIVATE' }], methods: [] },
      ],
      relations: [{ sourceClassName: 'Cliente', targetClassName: 'Pedido', type: 'ASSOCIATION', sourceMultiplicity: '1', targetMultiplicity: '0..*', label: 'realiza' }],
    });
  }

  async generateNewUml(prompt?: string, image?: AiImageInput) {
    const lower = (prompt || '').toLowerCase();

    // Caso: Análisis visual mediante Imagen / Foto para nuevo diagrama
    if (image || lower.includes('imagen') || lower.includes('foto')) {
      return {
        summary: 'Diagrama UML completo generado a partir de análisis visual de imagen',
        classes: [
          {
            name: 'Cliente',
            isAbstract: false,
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'nombre', type: 'String', visibility: 'PRIVATE' },
              { name: 'correo', type: 'String', visibility: 'PRIVATE' },
            ],
            methods: [
              { name: 'registrar', returnType: 'void', visibility: 'PUBLIC' },
            ],
          },
          {
            name: 'Pedido',
            isAbstract: false,
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'fecha', type: 'Date', visibility: 'PRIVATE' },
              { name: 'total', type: 'Decimal', visibility: 'PRIVATE' },
            ],
            methods: [
              { name: 'calcularTotal', returnType: 'Decimal', visibility: 'PUBLIC' },
            ],
          },
        ],
        relations: [
          {
            sourceClassName: 'Cliente',
            targetClassName: 'Pedido',
            type: 'ASSOCIATION',
            sourceMultiplicity: '1',
            targetMultiplicity: '0..*',
            label: 'realiza',
          },
        ],
      };
    }

    // Caso: Biblioteca / Libros
    if (lower.includes('biblioteca') || lower.includes('libro') || lower.includes('prestamo')) {
      return {
        summary: 'Sistema de Gestión de Biblioteca con Usuario, Libro y Préstamo',
        classes: [
          {
            name: 'Usuario',
            isAbstract: false,
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'nombre', type: 'String', visibility: 'PRIVATE' },
              { name: 'email', type: 'String', visibility: 'PRIVATE' },
              { name: 'telefono', type: 'String', visibility: 'PRIVATE' },
            ],
            methods: [
              { name: 'solicitarPrestamo', returnType: 'void', visibility: 'PUBLIC' },
            ],
          },
          {
            name: 'Libro',
            isAbstract: false,
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'titulo', type: 'String', visibility: 'PRIVATE' },
              { name: 'autor', type: 'String', visibility: 'PRIVATE' },
              { name: 'isbn', type: 'String', visibility: 'PRIVATE' },
              { name: 'disponible', type: 'Boolean', visibility: 'PRIVATE' },
            ],
            methods: [
              { name: 'prestar', returnType: 'void', visibility: 'PUBLIC' },
              { name: 'devolver', returnType: 'void', visibility: 'PUBLIC' },
            ],
          },
          {
            name: 'Prestamo',
            isAbstract: false,
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'fechaInicio', type: 'Date', visibility: 'PRIVATE' },
              { name: 'fechaDevolucion', type: 'Date', visibility: 'PRIVATE' },
              { name: 'estado', type: 'String', visibility: 'PRIVATE' },
            ],
            methods: [
              { name: 'finalizar', returnType: 'void', visibility: 'PUBLIC' },
            ],
          },
        ],
        relations: [
          {
            sourceClassName: 'Usuario',
            targetClassName: 'Prestamo',
            type: 'ASSOCIATION',
            sourceMultiplicity: '1',
            targetMultiplicity: '0..*',
            label: 'solicita',
          },
          {
            sourceClassName: 'Libro',
            targetClassName: 'Prestamo',
            type: 'ASSOCIATION',
            sourceMultiplicity: '1',
            targetMultiplicity: '0..*',
            label: 'prestado_en',
          },
        ],
      };
    }

    // Caso: Clinica / Medico / Paciente
    if (lower.includes('clinica') || lower.includes('medico') || lower.includes('paciente') || lower.includes('hospital')) {
      return {
        summary: 'Sistema de Gestión Clínica con Paciente, Médico y Consulta',
        classes: [
          {
            name: 'Paciente',
            isAbstract: false,
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'nombre', type: 'String', visibility: 'PRIVATE' },
              { name: 'historiaClinica', type: 'String', visibility: 'PRIVATE' },
            ],
            methods: [],
          },
          {
            name: 'Medico',
            isAbstract: false,
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'nombre', type: 'String', visibility: 'PRIVATE' },
              { name: 'especialidad', type: 'String', visibility: 'PRIVATE' },
            ],
            methods: [
              { name: 'atender', returnType: 'void', visibility: 'PUBLIC' },
            ],
          },
          {
            name: 'ConsultaMedica',
            isAbstract: false,
            attributes: [
              { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
              { name: 'fechaHora', type: 'Date', visibility: 'PRIVATE' },
              { name: 'diagnostico', type: 'String', visibility: 'PRIVATE' },
            ],
            methods: [],
          },
        ],
        relations: [
          {
            sourceClassName: 'Paciente',
            targetClassName: 'ConsultaMedica',
            type: 'ASSOCIATION',
            sourceMultiplicity: '1',
            targetMultiplicity: '0..*',
            label: 'solicita',
          },
          {
            sourceClassName: 'Medico',
            targetClassName: 'ConsultaMedica',
            type: 'ASSOCIATION',
            sourceMultiplicity: '1',
            targetMultiplicity: '0..*',
            label: 'atiende',
          },
        ],
      };
    }

    // Default generado desde texto / voz
    return {
      summary: 'Modelo UML generado para el sistema solicitado',
      classes: [
        {
          name: 'Cliente',
          isAbstract: false,
          attributes: [
            { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
            { name: 'nombre', type: 'String', visibility: 'PRIVATE' },
            { name: 'email', type: 'String', visibility: 'PRIVATE' },
          ],
          methods: [
            { name: 'registrar', returnType: 'void', visibility: 'PUBLIC' },
          ],
        },
        {
          name: 'Pedido',
          isAbstract: false,
          attributes: [
            { name: 'id', type: 'Long', visibility: 'PRIVATE', isPrimaryKey: true },
            { name: 'fecha', type: 'Date', visibility: 'PRIVATE' },
            { name: 'total', type: 'Decimal', visibility: 'PRIVATE' },
          ],
          methods: [
            { name: 'calcularTotal', returnType: 'Decimal', visibility: 'PUBLIC' },
          ],
        },
      ],
      relations: [
        {
          sourceClassName: 'Cliente',
          targetClassName: 'Pedido',
          type: 'ASSOCIATION',
          sourceMultiplicity: '1',
          targetMultiplicity: '0..*',
          label: 'realiza',
        },
      ],
    };
  }
}
