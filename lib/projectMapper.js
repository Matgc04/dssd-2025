/**
 * Utilidades para transformar datos del formulario al formato de Prisma
 */

/**
 * Mapea los tipos de request del formulario a los valores del enum de Prisma
 */
const mapRequestType = (formType) => {
  const typeMapping = {
    'economic': 'MONETARIO',
    'materials': 'MATERIALES',
    'labor': 'MANO_DE_OBRA',
    'other': 'OTRO'
  };
  return typeMapping[formType] || 'OTRO';
};

/**
 * Transforma los datos del formulario al formato requerido para crear un proyecto en Prisma
 * @param {Object} formData - Datos del formulario (estructura del form)
 * @returns {Object} - Datos formateados para Prisma
 */
export function transformFormDataToPrisma(formData) {
  const { project } = formData;
  
  return {
    name: project.name,
    description: project.description,
    originCountry: project.originCountry.toUpperCase(),
    startDate: new Date(project.startDate),
    endDate: new Date(project.endDate),
    createdByOrgId: project.createdByOrgId,
    stages: {
      create: project.stages.map((stage, stageIndex) => ({
        name: stage.name,
        description: stage.description || null,
        startDate: new Date(stage.startDate),
        endDate: new Date(stage.endDate),
        order: stageIndex,
        requests: {
          create: stage.requests.map((request, requestIndex) => ({
            type: mapRequestType(request.type),
            description: request.description,
            amount: request.amount ? parseFloat(request.amount) : null,
            currency: request.currency || null,
            quantity: request.quantity ? parseFloat(request.quantity) : null,
            unit: request.unit || null,
            order: requestIndex
          }))
        }
      }))
    }
  };
}

/**
 * Transforma los datos de Prisma al formato del formulario
 * @param {Object} projectData - Datos del proyecto desde Prisma
 * @returns {Object} - Datos formateados para el formulario
 */
export function transformPrismaToFormData(projectData) {
  const reverseTypeMapping = {
    'MONETARIO': 'economic',
    'MATERIALES': 'materials',
    'MANO_DE_OBRA': 'labor',
    'OTRO': 'other'
  };

  return {
    project: {
      name: projectData.name,
      description: projectData.description,
      originCountry: projectData.originCountry,
      startDate: projectData.startDate.toISOString().split('T')[0],
      endDate: projectData.endDate.toISOString().split('T')[0],
      createdByOrgId: projectData.createdByOrgId,
      stages: projectData.stages
        ?.sort((a, b) => a.order - b.order)
        .map(stage => ({
          name: stage.name,
          description: stage.description || '',
          startDate: stage.startDate.toISOString().split('T')[0],
          endDate: stage.endDate.toISOString().split('T')[0],
          requests: stage.requests
            ?.sort((a, b) => a.order - b.order)
            .map(request => ({
              type: reverseTypeMapping[request.type] || 'other',
              description: request.description,
              amount: request.amount ? parseFloat(request.amount) : undefined,
              currency: request.currency || '',
              quantity: request.quantity ? parseFloat(request.quantity) : undefined,
              unit: request.unit || ''
            })) || []
        })) || []
    }
  };
}
