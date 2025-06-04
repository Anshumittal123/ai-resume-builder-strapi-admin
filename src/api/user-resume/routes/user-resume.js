// 'use strict';

// /**
//  * user-resume router
//  */

// const { createCoreRouter } = require('@strapi/strapi').factories;

// module.exports = createCoreRouter('api::user-resume.user-resume');


'use strict';

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/user-resume/get-all-resumes',
      handler: 'user-resume.getAllResumes',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/filter-resumes',
      handler: 'user-resume.filterResumes',
      config: {
        policies: [],
        middlewares: [],
      },
    },

    {
      method: 'GET',
      path: '/user-resumes',
      handler: 'user-resume.find',
    },
    {
      method: 'GET',
      path: '/user-resumes/:id',
      handler: 'user-resume.findOne',
    },
    {
      method: 'POST',
      path: '/user-resumes',
      handler: 'user-resume.create',
    },
    {
      method: 'PUT',
      path: '/user-resumes/:id',
      handler: 'user-resume.update',
    },
    {
      method: 'DELETE',
      path: '/user-resumes/:id',
      handler: 'user-resume.delete',
    }
  ],
};

