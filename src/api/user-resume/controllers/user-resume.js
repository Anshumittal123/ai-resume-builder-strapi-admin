// 'use strict';

// /**
//  * user-resume controller
//  */

// const { createCoreController } = require('@strapi/strapi').factories;

// module.exports = createCoreController('api::user-resume.user-resume');


'use strict';

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { AIChatSession } = require('../../../utils/AIModal.js');
const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::user-resume.user-resume', ({ strapi }) => ({

  async filterResumes(ctx) {
      const keyword = ctx.request?.body?.keyword || '';


    if (!keyword) {
      return ctx.badRequest('Keyword is required');
    }

    try {
      const resumeFolder = path.join(__dirname, '../../../../public/resumes');
      const files = fs.readdirSync(resumeFolder).filter(f => f.endsWith('.pdf'));

      const matchedResumes = [];

      for (let file of files) {
        const filePath = path.join(resumeFolder, file);
        const dataBuffer = fs.readFileSync(filePath);
        const pdfText = await pdfParse(dataBuffer);

        const prompt = `Does this resume match the keyword "${keyword}"? Answer only YES or NO.\n\nResume Content:\n${pdfText.text}`;
        console.log(prompt);

        const result = await AIChatSession.sendMessage(prompt);
        const output = (await result.response.text()).toLowerCase();
        console.log(output);

        if (output.includes('yes')) {
          matchedResumes.push(`http://localhost:1337/resumes/${file}`);
        }
      }

      ctx.send({ matchedResumes });

    } catch (err) {
      console.error("Resume filter error:", err);
      ctx.internalServerError("Failed to filter resumes");
    }
  }

}));
