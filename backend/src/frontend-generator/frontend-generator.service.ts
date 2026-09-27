import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectsService } from '../projects/projects.service';
import { GenerateFrontendPromptDto } from './dto/generate-frontend-prompt.dto';

const COMPLETE_DIAGRAM_INCLUDE = {
  classes: {
    include: {
      attributes: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] },
      methods: { orderBy: [{ position: 'asc' as const }, { id: 'asc' as const }] },
    },
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
  },
  relations: { orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }] },
};

@Injectable()
export class FrontendGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async generatePrompt(dto: GenerateFrontendPromptDto, userId: string): Promise<{ success: boolean; prompt: string }> {
    const project = await this.projects.validateAccess(dto.projectId, userId);
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const diagram = await this.prisma.diagram.findUnique({
      where: { projectId: dto.projectId },
      include: COMPLETE_DIAGRAM_INCLUDE,
    });

    if (!diagram || diagram.classes.length === 0) {
      throw new BadRequestException('El proyecto no cuenta con clases UML modeladas para generar la aplicación.');
    }

    // Determine platform (WEB vs MOBILE)
    const rawPlatform = (dto.platform || '').trim().toUpperCase();
    const rawFw = (dto.framework || dto.frontendFramework || '').trim();
    const isMobile = rawPlatform === 'MOBILE' || /flutter|react[ _-]?native/i.test(rawFw);

    let prompt = '';
    if (isMobile) {
      const framework = this.normalizeMobileFramework(rawFw);
      const architecture = this.normalizeArchitecture(dto.architecture);
      const stateManagement = this.normalizeStateManagement(dto.stateManagement);
      prompt = this.buildMobileMetaPrompt(project, diagram, framework, architecture, stateManagement, dto.includeFlutterPrep);
    } else {
      const frontendFw = this.normalizeWebFramework(rawFw);
      const stylingFw = this.normalizeWebStyling(dto.style || dto.stylingFramework);
      prompt = this.buildWebMetaPrompt(project, diagram, frontendFw, stylingFw);
    }

    return {
      success: true,
      prompt,
    };
  }

  // =========================================================================
  // PROMPT BUILDER: MOBILE (Flutter / React Native)
  // =========================================================================
  private buildMobileMetaPrompt(
    project: any,
    diagram: any,
    framework: string,
    architecture: string,
    stateManagement: string,
    includeFlutterPrep?: boolean,
  ): string {
    const classIdToName = new Map<string, string>();
    diagram.classes.forEach((c: any) => classIdToName.set(c.id, c.name));

    // Endpoints detection & mapping
    const endpointsByEntity = diagram.classes.map((umlClass: any) => {
      const entityName = umlClass.name;
      const endpointBase = this.pluralizeEndpoint(entityName);
      const customMethods = umlClass.methods.map((m: any) => {
        const httpVerb = this.inferHttpVerb(m.name);
        const methodPath = this.slugify(m.name);
        return `  - ${httpVerb} /api/${endpointBase}/${methodPath} -> Operación personalizada (${m.returnType || 'void'})`;
      });

      return {
        entityName,
        endpointBase,
        standardEndpoints: [
          `  - GET /api/${endpointBase} -> Listar todos los registros`,
          `  - GET /api/${endpointBase}/{id} -> Obtener detalle por ID`,
          `  - POST /api/${endpointBase} -> Crear nuevo registro`,
          `  - PUT /api/${endpointBase}/{id} -> Actualizar registro existente`,
          `  - DELETE /api/${endpointBase}/{id} -> Eliminar registro por ID`,
        ],
        customEndpoints: customMethods,
      };
    });

    // Entities detection
    const entitiesText = diagram.classes
      .map((c: any) => {
        const attributesText = c.attributes.length
          ? c.attributes
              .map(
                (a: any) =>
                  `  - ${a.name}: ${this.toDartType(a.type)}${a.isPrimaryKey ? ' (Primary Key, Identificador único)' : ''} [${a.visibility.toLowerCase()}]`,
              )
              .join('\n')
          : '  - (Sin atributos declarados)';

        const methodsText = c.methods.length
          ? c.methods
              .map((m: any) => `  - ${m.name}(): ${this.toDartType(m.returnType || 'void')} [${m.visibility.toLowerCase()}]`)
              .join('\n')
          : '  - (Métodos CRUD estándar)';

        const classRelations = diagram.relations.filter(
          (r: any) => r.sourceClassId === c.id || r.targetClassId === c.id,
        );

        const relationsText = classRelations.length
          ? classRelations
              .map((r: any) => {
                const isSource = r.sourceClassId === c.id;
                const otherClassName = isSource
                  ? classIdToName.get(r.targetClassId) || 'Clase externa'
                  : classIdToName.get(r.sourceClassId) || 'Clase externa';
                const mult = isSource
                  ? `(Multiplicidad: ${r.sourceMultiplicity || '1'} -> ${r.targetMultiplicity || '1'})`
                  : `(Multiplicidad: ${r.targetMultiplicity || '1'} -> ${r.sourceMultiplicity || '1'})`;
                return `  - ${r.type}: Relacionado con ${otherClassName} ${r.label ? `[Etiqueta: "${r.label}"]` : ''} ${mult}`;
              })
              .join('\n')
          : '  - (Sin relaciones externas)';

        return `### Entidad: ${c.name}${c.isAbstract ? ' (Abstracta)' : ''}
Atributos (Tipos Dart/Mobile):
${attributesText}

Relaciones en el modelo UML:
${relationsText}

Métodos de negocio:
${methodsText}`;
      })
      .join('\n\n');

    const endpointsText = endpointsByEntity
      .map((e: any) => {
        let block = `#### ${e.entityName} (/api/${e.endpointBase})
${e.standardEndpoints.join('\n')}`;
        if (e.customEndpoints.length > 0) {
          block += `\nEndpoints adicionales:\n${e.customEndpoints.join('\n')}`;
        }
        return block;
      })
      .join('\n\n');

    const description = project.description?.trim() || 'Sistema empresarial multiplataforma.';
    const isFlutter = framework.toLowerCase().includes('flutter');

    let flutterPreparationSection = '';
    if (isFlutter || includeFlutterPrep) {
      flutterPreparationSection = `
================================================================================
📱 PREPARACIÓN DEL PROYECTO FLUTTER
================================================================================
El proyecto generado debe configurarse con:

Framework:
Flutter + Dart

Arquitectura:
- ${architecture}

Gestión de estado:
- ${stateManagement}

Configuración de compilación:
1. Instalar dependencias:
   \`flutter pub get\`

2. Ejecutar aplicación en desarrollo:
   \`flutter run\`

3. Generar APK Release listo para instalación:
   \`flutter build apk --release\`

4. Ubicación del APK generado:
   \`build/app/outputs/flutter-apk/app-release.apk\`

--------------------------------------------------------------------------------
CONFIGURACIÓN MOBILE FINAL
--------------------------------------------------------------------------------
Genera una aplicación Flutter lista para conectarse al backend Spring Boot generado.

Requisitos:
- Crear estructura de carpetas basada en ${architecture}.
- Implementar consumo REST mediante Dio o HTTP Client con interceptores y manejo de timeout.
- Crear modelos Dart con serialización completa fromJson y toJson.
- Crear servicios API desacoplados para cada entidad detectada.
- Configurar base URL:
  * Android Emulator: http://10.0.2.2:8080/api
  * Dispositivo físico: http://IP_LOCAL_DEL_SERVIDOR:8080/api

Generar:
- Login con persistencia de token JWT si existe autenticación.
- Dashboard principal con KPIs y menú de navegación.
- Pantallas CRUD completas con ListView y Pull-to-Refresh.
- Formularios interactivos con validación de campos.
- Manejo de errores amigable y banners de notificación (SnackBars).
- Estados de carga (Spinners / Shimmer loaders).
- Navegación fluida y estructurada (GoRouter o Navigator 2.0).

Comandos de despliegue:
\`\`\`bash
flutter pub get
flutter run
flutter build apk --release
\`\`\`
`;
    }

    return `================================================================================
META-PROMPT ESPECIALIZADO: GENERADOR DE APLICACIÓN MOBILE IA
================================================================================

1. ROL DEL MODELO IA
--------------------------------------------------------------------------------
Actúa como un Desarrollador Mobile Senior y Arquitecto de Software especializado en ${framework}. Tu objetivo es generar una aplicación móvil completa, moderna, robusta y optimizada para producción, conectada al backend Spring Boot generado por la plataforma CASE ARQNOVA.

2. INFORMACIÓN DEL SISTEMA
--------------------------------------------------------------------------------
- Nombre del Proyecto: ${project.name}
- Descripción: ${description}
- Plataforma: Mobile (Android / iOS)
- Entorno de Origen: Plataforma CASE ARQNOVA

3. BACKEND DISPONIBLE
--------------------------------------------------------------------------------
- Framework Backend: Spring Boot (Java 21, REST API con validaciones Jakarta)
- Base URL del API: http://localhost:8080/api (En emulador Android usar http://10.0.2.2:8080/api o IP local)
- Formato de Datos: JSON (application/json)
- Manejo de Errores: Códigos de respuesta HTTP 200, 201, 400, 404, 409 y 500 estructurados.

Endpoints REST detectados:
${endpointsText}

4. ENTIDADES Y MODELO DE DATOS DETECTADOS (UML)
--------------------------------------------------------------------------------
${entitiesText}

5. COMPONENTES Y PANTALLAS MOBILE SOLICITADAS
--------------------------------------------------------------------------------
Debes diseñar e implementar los siguientes módulos y pantallas para la app móvil:
1. Pantalla de Bienvenida (Splash & Onboarding) y Autenticación con manejo seguro de tokens JWT.
2. Dashboard Móvil Principal:
   - Resumen visual con tarjetas de métricas cuantitativas para las entidades del negocio.
   - Acciones de creación rápida (Floating Action Button o botones de acción en barra superior).
   - Menú de navegación inferior (Bottom Navigation Bar) o Drawer lateral.
3. Vistas CRUD por cada Entidad:
   - Pantalla de Listado: ListView interactivo con tarjetas de diseño limpio, Pull-to-Refresh para actualizar datos, barra de búsqueda en tiempo real, filtros y paginación infinita.
   - Pantalla de Detalle: Visualización clara de todos los atributos y relaciones de la entidad seleccionada.
   - Pantalla / Modal de Formulario: Campos de texto con validaciones síncronas/asíncronas, selectores de fecha/hora, dropdowns para relaciones de clave foránea y control de errores visual en tiempo real.
   - Diálogo de confirmación para acciones destructivas (Eliminar registro).
4. Capa de Red y Servicios HTTP:
   - Cliente HTTP centralizado (${isFlutter ? 'Dio / http package' : 'Axios / Fetch'}) con interceptores de autenticación y timeout configurables.
   - Serialización de modelos (${isFlutter ? 'fromJson y toJson' : 'TypeScript interfaces / DTOs'}).
   - Notificaciones contextuales (${isFlutter ? 'SnackBar / BottomSheet' : 'Toast / Modal Alert'}) para feedback inmediato al usuario.
   - Vistas de carga (Shimmer / Skeleton loaders) y estado vacío (Empty state con ilustraciones vectoriales).

6. ARQUITECTURA Y GESTIÓN DE ESTADO SELECCIONADAS
--------------------------------------------------------------------------------
- Framework Mobile: ${framework}
- Arquitectura: ${architecture}
- Gestión de Estado: ${stateManagement}

Pautas para la arquitectura seleccionada:
${this.getMobileArchitectureInstructions(framework, architecture, stateManagement)}
${flutterPreparationSection}
7. INSTRUCCIÓN FINAL PARA LA GENERACIÓN DE CÓDIGO
--------------------------------------------------------------------------------
Por favor, genera:
1. La estructura de carpetas completa del proyecto ${framework} siguiendo ${architecture}.
2. Los modelos de datos y DTOs con serialización JSON completa.
3. El servicio de cliente API REST configurado para la Base URL http://localhost:8080/api.
4. La capa de gestión de estado con ${stateManagement} para cada entidad.
5. Las pantallas de UI (Dashboard, Listado CRUD, Detalle y Formulario).
6. Los comandos para compilar y ejecutar la aplicación (${isFlutter ? 'flutter run, flutter build apk --release' : 'npm run android, npm run ios'}).
7. Todo el código debe estar completamente implementado, sin placeholders y listo para producción.`;
  }

  // =========================================================================
  // PROMPT BUILDER: WEB (React / Angular / Vue)
  // =========================================================================
  private buildWebMetaPrompt(
    project: any,
    diagram: any,
    frontendFramework: string,
    stylingFramework: string,
  ): string {
    const classIdToName = new Map<string, string>();
    diagram.classes.forEach((c: any) => classIdToName.set(c.id, c.name));

    // Endpoints detection & mapping
    const endpointsByEntity = diagram.classes.map((umlClass: any) => {
      const entityName = umlClass.name;
      const endpointBase = this.pluralizeEndpoint(entityName);
      const customMethods = umlClass.methods.map((m: any) => {
        const httpVerb = this.inferHttpVerb(m.name);
        const methodPath = this.slugify(m.name);
        return `  - ${httpVerb} /api/${endpointBase}/${methodPath} -> Operación personalizada (${m.returnType || 'void'})`;
      });

      return {
        entityName,
        endpointBase,
        standardEndpoints: [
          `  - GET /api/${endpointBase} -> Listar todos los registros`,
          `  - GET /api/${endpointBase}/{id} -> Obtener detalle por ID`,
          `  - POST /api/${endpointBase} -> Crear nuevo registro`,
          `  - PUT /api/${endpointBase}/{id} -> Actualizar registro existente`,
          `  - DELETE /api/${endpointBase}/{id} -> Eliminar registro por ID`,
        ],
        customEndpoints: customMethods,
      };
    });

    // Entities detection
    const entitiesText = diagram.classes
      .map((c: any) => {
        const attributesText = c.attributes.length
          ? c.attributes
              .map(
                (a: any) =>
                  `  - ${a.name}: ${a.type}${a.isPrimaryKey ? ' (Primary Key, Identificador único)' : ''} [${a.visibility.toLowerCase()}]`,
              )
              .join('\n')
          : '  - (Sin atributos declarados)';

        const methodsText = c.methods.length
          ? c.methods
              .map((m: any) => `  - ${m.name}(): ${m.returnType || 'void'} [${m.visibility.toLowerCase()}]`)
              .join('\n')
          : '  - (Métodos CRUD estándar)';

        const classRelations = diagram.relations.filter(
          (r: any) => r.sourceClassId === c.id || r.targetClassId === c.id,
        );

        const relationsText = classRelations.length
          ? classRelations
              .map((r: any) => {
                const isSource = r.sourceClassId === c.id;
                const otherClassName = isSource
                  ? classIdToName.get(r.targetClassId) || 'Clase externa'
                  : classIdToName.get(r.sourceClassId) || 'Clase externa';
                const mult = isSource
                  ? `(Multiplicidad: ${r.sourceMultiplicity || '1'} -> ${r.targetMultiplicity || '1'})`
                  : `(Multiplicidad: ${r.targetMultiplicity || '1'} -> ${r.sourceMultiplicity || '1'})`;
                return `  - ${r.type}: Relacionado con ${otherClassName} ${r.label ? `[Etiqueta: "${r.label}"]` : ''} ${mult}`;
              })
              .join('\n')
          : '  - (Sin relaciones externas)';

        return `### Entidad: ${c.name}${c.isAbstract ? ' (Abstracta)' : ''}
Atributos:
${attributesText}

Relaciones en el modelo UML:
${relationsText}

Métodos de negocio:
${methodsText}`;
      })
      .join('\n\n');

    const endpointsText = endpointsByEntity
      .map((e: any) => {
        let block = `#### ${e.entityName} (/api/${e.endpointBase})
${e.standardEndpoints.join('\n')}`;
        if (e.customEndpoints.length > 0) {
          block += `\nEndpoints adicionales:\n${e.customEndpoints.join('\n')}`;
        }
        return block;
      })
      .join('\n\n');

    const description = project.description?.trim() || 'Sistema de gestión y modelado empresarial.';

    return `================================================================================
META-PROMPT ESPECIALIZADO: GENERADOR DE APLICACIÓN WEB IA
================================================================================

1. ROL DEL MODELO IA
--------------------------------------------------------------------------------
Actúa como un Desarrollador Frontend Senior y Arquitecto de Software UI/UX especializado en aplicaciones empresariales y SaaS modernos. Tu objetivo es generar una solución de frontend completa, modular, escalable, con código limpio (Clean Code) y tipado estricto en TypeScript basada en las especificaciones exactas del sistema.

2. INFORMACIÓN DEL SISTEMA
--------------------------------------------------------------------------------
- Nombre del Proyecto: ${project.name}
- Descripción del Negocio: ${description}
- Plataforma: Web SPA
- Entorno de Origen: Plataforma CASE ARQNOVA

3. BACKEND DISPONIBLE
--------------------------------------------------------------------------------
- Framework Backend: Spring Boot (Java 21, REST API con validaciones Jakarta)
- Base URL del API: http://localhost:8080/api
- Formato de Datos: JSON (application/json)
- Manejo de Errores Backend: Respuestas de error estructuradas HTTP 400 (Bad Request), 404 (Not Found), 409 (Conflict) y 500 (Internal Server Error).

Endpoints REST generados del sistema:
${endpointsText}

4. ENTIDADES Y MODELO DE DATOS DETECTADOS (UML)
--------------------------------------------------------------------------------
${entitiesText}

5. COMPONENTES FRONTEND REQUERIDOS
--------------------------------------------------------------------------------
Debes diseñar e implementar los siguientes componentes clave del frontend:
1. Dashboard Principal:
   - Panel con tarjetas de métricas cuantitativas (KPIs) para cada una de las entidades principales.
   - Gráficos o vistas resumen de actividad reciente.
   - Accesos directos a las funciones de creación rápida.
2. Layout Estructurado:
   - Sidebar de navegación persistente y colapsable con accesos a cada módulo CRUD de las entidades.
   - Navbar superior con indicador del estado de la conexión con el backend (Health Check), selector de proyectos, notificaciones y perfil de usuario.
3. Vistas y Módulos CRUD por cada Entidad:
   - Listado / Tablas Interactivas: Paginación, búsqueda en tiempo real, filtros por columnas, ordenamiento y acciones rápidas (Ver, Editar, Eliminar).
   - Formularios de Creación / Edición: Modales o páginas dedicadas con validaciones de campos requeridos, tipos de datos, validaciones de formato (email, números positivos, fechas) y prevención de envíos dobles.
   - Diálogos de Confirmación: Modales para confirmación de eliminación de registros con advertencia destructiva.
4. Gestión de Estados y Feedback al Usuario:
   - Skeletons y spinners durante la carga asíncrona de datos.
   - Notificaciones Toast/Alertas contextuales para éxitos (registro creado, actualizado o eliminado) y errores controlados.
   - Vistas de "Sin datos" (Empty States) elegantes cuando una lista esté vacía.
   - Cliente HTTP centralizado con interceptores para manejar la Base URL, cabeceras y captura global de errores de red.

6. REQUISITOS DE DISEÑO E INTERFAZ (UI/UX)
--------------------------------------------------------------------------------
- Diseño 100% Responsive: Adaptación impecable en dispositivos Desktop, Tablet y Mobile.
- Estilo Visual: SaaS moderno, paleta cromática sofisticada (fondos oscuros o claros limpios con acentos de color azul/índigo/violeta), tarjetas con bordes suaves (rounded-2xl), sombras sutiles y micro-interacciones al hacer hover.
- Arquitectura Modular: Separación limpia de responsabilidades (Servicios API, Hooks personalizados, Componentes de UI reutilizables, Tipos/Interfaces TypeScript y Páginas/Vistas).
- Accesibilidad: Etiquetas semánticas HTML5, atributos ARIA cuando corresponda y contraste de colores legible.

7. STACK TECNOLÓGICO SELECCIONADO
--------------------------------------------------------------------------------
- Framework Frontend: ${frontendFramework}
- Framework de Estilos: ${stylingFramework}
- Lenguaje: TypeScript (modo estricto)

Instrucciones específicas para el Stack:
${this.getWebStackInstructions(frontendFramework, stylingFramework)}

8. INSTRUCCIÓN FINAL PARA LA GENERACIÓN DE CÓDIGO
--------------------------------------------------------------------------------
Por favor, genera:
1. La estructura de carpetas recomendada del proyecto frontend.
2. Las interfaces y tipos TypeScript para cada una de las entidades y DTOs del sistema.
3. La capa de servicios HTTP configurada para consumir los endpoints REST del backend Spring Boot.
4. El enrutador y la vista del Dashboard principal.
5. El módulo CRUD completo para las entidades principales con sus componentes de tabla y formulario.
6. Asegura que todo el código sea funcional, libre de errores sintácticos y listo para producción.`;
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================
  private getMobileArchitectureInstructions(framework: string, architecture: string, stateManagement: string): string {
    const isFlutter = framework.toLowerCase().includes('flutter');
    let archGuide = '';
    if (architecture.toUpperCase().includes('CLEAN')) {
      archGuide = `- Estructura en 3 capas (Clean Architecture):
  1. Data Layer: Data sources (HTTP Client Dio/http), DTOs con serialización JSON, Implementaciones de Repositorios.
  2. Domain Layer: Entidades puras de negocio, Interfaces de Repositorios, Casos de Uso (UseCases).
  3. Presentation Layer: ${stateManagement} (${isFlutter ? 'ChangeNotifier/Notifier/Cubit/Bloc' : 'State Hook/Store'}), Widgets / Screens y Formularios.`;
    } else {
      archGuide = `- Estructura MVVM (Model-View-ViewModel):
  1. Models: Entidades y DTOs mapeados.
  2. ViewModels / Controllers: Lógica de negocio y gestión de estado con ${stateManagement}.
  3. Views / Screens: Vistas desacopladas que observan los cambios del ViewModel.`;
    }

    let stateGuide = '';
    if (isFlutter) {
      if (stateManagement.toUpperCase().includes('BLOC')) {
        stateGuide = `- Implementa flutter_bloc / Cubits para la reactividad. Define Events, States y emite estados de Loading, Success y Error.`;
      } else if (stateManagement.toUpperCase().includes('RIVERPOD')) {
        stateGuide = `- Implementa flutter_riverpod con StateNotifierProvider / AsyncNotifierProvider para gestión reactiva declarativa.`;
      } else {
        stateGuide = `- Implementa provider con ChangeNotifier / ChangeNotifierProvider para una gestión de estado simple y desacoplada.`;
      }
    } else {
      stateGuide = `- Utiliza gestión de estado reactiva moderna con hooks / store desacoplado para React Native.`;
    }

    return `${archGuide}\n${stateGuide}`;
  }

  private getWebStackInstructions(frontendFw: string, stylingFw: string): string {
    const isReact = frontendFw.includes('React');
    const isAngular = frontendFw.includes('Angular');
    const isVue = frontendFw.includes('Vue');
    const isTailwind = stylingFw.includes('Tailwind');

    let fwGuide = '';
    if (isReact) {
      fwGuide = `- Estructura basada en React 18+ con Vite y React Router.
- Utiliza Custom Hooks para la gestión de estados asíncronos y llamadas a la API (o React Query / TanStack Query si aplica).
- Componentes funcionales limpios con tipado exhaustivo mediante TypeScript Props.`;
    } else if (isAngular) {
      fwGuide = `- Estructura basada en Angular 17+ con Standalone Components.
- Utiliza Services con HttpClient y Signals / RxJS (Observables) para la reactividad.
- Reactive Forms con FormBuilder y Validators para todos los formularios CRUD.`;
    } else if (isVue) {
      fwGuide = `- Estructura basada en Vue 3 con Vite y Vue Router.
- Utiliza Composition API con <script setup lang="ts">.
- Manejo de estado centralizado con Pinia y llamadas HTTP con Axios composables.`;
    }

    let styleGuide = '';
    if (isTailwind) {
      styleGuide = `- Utiliza clases utilitarias de Tailwind CSS para una interfaz estilizada y responsiva.
- Diseña con degradados sutiles (bg-gradient-to-r), bordes redondeados (rounded-xl / rounded-2xl), y transiciones fluidas.`;
    } else {
      styleGuide = `- Utiliza componentes de Material UI (MUI) con un tema personalizado consistente.
- Aprovecha DataGrid / Tables, Dialogs, Snackbars, y TextField con validación visual.`;
    }

    return `${fwGuide}\n${styleGuide}`;
  }

  private normalizeMobileFramework(value?: string): string {
    const lower = (value || '').toLowerCase();
    if (lower.includes('react') || lower.includes('native')) return 'React Native';
    return 'Flutter + Dart';
  }

  private normalizeArchitecture(value?: string): string {
    const upper = (value || '').toUpperCase();
    if (upper.includes('MVVM')) return 'MVVM';
    return 'Clean Architecture';
  }

  private normalizeStateManagement(value?: string): string {
    const upper = (value || '').toUpperCase();
    if (upper.includes('BLOC')) return 'Bloc';
    if (upper.includes('RIVERPOD')) return 'Riverpod';
    return 'Provider';
  }

  private normalizeWebFramework(value?: string): string {
    const lower = (value || '').toLowerCase();
    if (lower.includes('angular')) return 'Angular';
    if (lower.includes('vue')) return 'Vue';
    return 'React + Vite';
  }

  private normalizeWebStyling(value?: string): string {
    const lower = (value || '').toLowerCase();
    if (lower.includes('material')) return 'Material UI';
    return 'Tailwind CSS';
  }

  private toDartType(type: string): string {
    const lower = type.trim().toLowerCase();
    if (lower === 'string' || lower === 'text') return 'String';
    if (lower === 'int' || lower === 'integer' || lower === 'long') return 'int';
    if (lower === 'double' || lower === 'float' || lower === 'decimal' || lower === 'bigdecimal') return 'double';
    if (lower === 'bool' || lower === 'boolean') return 'bool';
    if (lower === 'date' || lower === 'datetime' || lower === 'timestamp') return 'DateTime';
    if (lower.startsWith('list') || lower.endsWith('[]')) return 'List';
    return type || 'dynamic';
  }

  private pluralizeEndpoint(name: string): string {
    const clean = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .join('-')
      .toLowerCase();

    if (!clean) return 'items';
    if (clean.endsWith('s') || clean.endsWith('x') || clean.endsWith('z')) return `${clean}es`;
    if (clean.endsWith('a') || clean.endsWith('e') || clean.endsWith('i') || clean.endsWith('o') || clean.endsWith('u')) {
      return `${clean}s`;
    }
    return `${clean}s`;
  }

  private inferHttpVerb(methodName: string): string {
    const lower = methodName.toLowerCase();
    if (lower.startsWith('get') || lower.startsWith('find') || lower.startsWith('list') || lower.startsWith('search') || lower.startsWith('obtener') || lower.startsWith('buscar')) {
      return 'GET';
    }
    if (lower.startsWith('create') || lower.startsWith('add') || lower.startsWith('new') || lower.startsWith('crear') || lower.startsWith('registrar') || lower.startsWith('insert')) {
      return 'POST';
    }
    if (lower.startsWith('update') || lower.startsWith('edit') || lower.startsWith('modify') || lower.startsWith('actualizar') || lower.startsWith('modificar')) {
      return 'PUT';
    }
    if (lower.startsWith('delete') || lower.startsWith('remove') || lower.startsWith('eliminar') || lower.startsWith('borrar')) {
      return 'DELETE';
    }
    return 'POST';
  }

  private slugify(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'action';
  }
}
