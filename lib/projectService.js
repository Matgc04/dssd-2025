import prisma from './prisma';
import { transformFormDataToPrisma, transformPrismaToFormData } from './projectMapper';

/**
 * Servicio para operaciones CRUD de proyectos
 */

/**
 * Crea un nuevo proyecto con sus etapas y pedidos
 * @param {Object} formData - Datos del formulario
 * @param {Object} options - Opciones adicionales (bonitaCaseId, etc.)
 * @returns {Promise<Object>} - Proyecto creado
 */
export async function createProject(formData, options = {}) {
  try {
    console.log('Creating project with data:', JSON.stringify(formData, null, 2));

    const prismaData = transformFormDataToPrisma(formData.contract);

    // Agregar campos opcionales si están presentes
    if (options.bonitaCaseId) {
      prismaData.bonitaCaseId = String(options.bonitaCaseId);
    }
    if (options.status) {
      prismaData.status = String(options.status);
    }

    console.log('Transformed Prisma data:', JSON.stringify(prismaData, null, 2));

    const project = await prisma.project.create({
      data: prismaData,
      include: {
        stages: {
          include: {
            requests: {
              include: {
                collaborations: {
                  select: {
                    id: true,
                    status: true
                  }
                }
              },
              orderBy: {
                order: 'asc'
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    console.log('Project created successfully:', project.id);
    return project;
  } catch (error) {
    console.error('Error creating project:', error);
    throw new Error('Failed to create project: ' + error.message);
  }
}

/**
 * Obtiene un proyecto por ID
 * @param {string} projectId - ID del proyecto
 * @returns {Promise<Object|null>} - Proyecto encontrado o null
 */
export async function getProjectById(projectId) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        stages: {
          include: {
            requests: {
              include: {
                collaborations: {
                  select: {
                    id: true,
                    status: true
                  }
                }
              },
              orderBy: {
                order: 'asc'
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    return project;
  } catch (error) {
    console.error('Error fetching project:', error);
    throw new Error('Failed to fetch project: ' + error.message);
  }
}

/**
 * Obtiene un proyecto por Bonita Case ID
 * @param {string} bonitaCaseId - ID del caso en Bonita
 * @returns {Promise<Object|null>} - Proyecto encontrado o null
 */
export async function getProjectByBonitaCaseId(bonitaCaseId) {
  try {
    const project = await prisma.project.findUnique({
      where: { bonitaCaseId },
      include: {
        stages: {
          include: {
            requests: {
              include: {
                collaborations: {
                  select: {
                    id: true,
                    status: true
                  }
                }
              },
              orderBy: {
                order: 'asc'
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    return project;
  } catch (error) {
    console.error('Error fetching project by Bonita Case ID:', error);
    throw new Error('Failed to fetch project: ' + error.message);
  }
}

/**
 * Obtiene todos los proyectos con paginación
 * @param {Object} options - Opciones de paginación y filtros
 * @returns {Promise<Object>} - Lista de proyectos con metadatos
 */
export async function getProjects(options = {}) {
  const {
    page = 1,
    limit = 10,
    orderBy = 'createdAt',
    orderDirection = 'desc',
    orgId,
    status
  } = options;

  try {
    const where = {};

    if (orgId) {
      where.createdByOrgId = orgId;
    }

    if (status) {
      where.status = status;
    }

    const [projects, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: {
          comments: {
            where: { resolved: false },
            select: {
              id: true,
              resolved: true,
            },
          },
          stages: {
            include: {
              requests: {
                include: {
                  collaborations: {
                    select: {
                      id: true,
                      status: true
                    }
                  }
                },
                orderBy: {
                  order: 'asc'
                }
              }
            },
            orderBy: {
              order: 'asc'
            }
          }
        },
        orderBy: {
          [orderBy]: orderDirection
        },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.project.count({ where })
    ]);

    return {
      projects,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching projects:', error);
    throw new Error('Failed to fetch projects: ' + error.message);
  }
}

/**
 * Actualiza un proyecto existente
 * @param {string} projectId - ID del proyecto
 * @param {Object} formData - Datos del formulario actualizados
 * @returns {Promise<Object>} - Proyecto actualizado
 */
export async function updateProject(projectId, formData) {
  try {
    // Primero eliminamos las etapas y pedidos existentes
    await prisma.stage.deleteMany({
      where: { projectId }
    });

    // Luego actualizamos el proyecto con los nuevos datos
    const prismaData = transformFormDataToPrisma(formData);

    const project = await prisma.project.update({
      where: { id: projectId },
      data: prismaData,
      include: {
        stages: {
          include: {
            requests: {
              include: {
                collaborations: {
                  select: {
                    id: true,
                    status: true
                  }
                }
              },
              orderBy: {
                order: 'asc'
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    return project;
  } catch (error) {
    console.error('Error updating project:', error);
    throw new Error('Failed to update project: ' + error.message);
  }
}

/**
 * Actualiza el estado del proceso de un proyecto
 * @param {string} projectId - ID del proyecto
 * @param {string} status - Nuevo estado
 * @returns {Promise<Object>} - Proyecto actualizado
 */
export async function updateProjectStatus(projectId, status) {
  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: { status },
      include: {
        stages: {
          include: {
            requests: {
              include: {
                collaborations: {
                  select: {
                    id: true,
                    status: true
                  }
                }
              },
              orderBy: {
                order: 'asc'
              }
            }
          },
          orderBy: {
            order: 'asc'
          },
        }
      }
    });

  return project;
} catch (error) {
  console.error('Error updating project status:', error);
  throw new Error('Failed to update project status: ' + error.message);
}
}

/**
 * Actualiza el Bonita Case ID de un proyecto
 * @param {string} projectId - ID del proyecto
 * @param {string} bonitaCaseId - ID del caso en Bonita
 * @returns {Promise<Object>} - Proyecto actualizado
 */
export async function updateProjectBonitaCaseId(projectId, bonitaCaseId) {
  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        bonitaCaseId: String(bonitaCaseId),
        status: 'STARTED'
      },
      include: {
        stages: {
          include: {
            requests: {
              include: {
                collaborations: {
                  select: {
                    id: true,
                    status: true
                  }
                }
              },
              orderBy: {
                order: 'asc'
              }
            }
          },
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    return project;
  } catch (error) {
    console.error('Error updating project Bonita Case ID:', error);
    throw new Error('Failed to update project Bonita Case ID: ' + error.message);
  }
}

/**
 * Elimina un proyecto y todas sus etapas y pedidos
 * @param {string} projectId - ID del proyecto
 * @returns {Promise<Object>} - Proyecto eliminado
 */
export async function deleteProject(projectId) {
  try {
    const project = await prisma.project.delete({
      where: { id: projectId },
      include: {
        stages: {
          include: {
            requests: {
              include: {
                collaborations: {
                  select: {
                    id: true,
                    status: true
                  }
                }
              },
              orderBy: {
                order: 'asc'
              }
            }
          }
        }
      }
    });

    return project;
  } catch (error) {
    console.error('Error deleting project:', error);
    throw new Error('Failed to delete project: ' + error.message);
  }
}
