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
const mammoth = require('mammoth'); //
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
      const files = fs.readdirSync(resumeFolder).filter(f => f.endsWith('.pdf') || f.endsWith('.doc') || f.endsWith('.docx')); //

      const matchedResumes = [];

      for (let file of files) {
        // const filePath = path.join(resumeFolder, file);
        // const dataBuffer = fs.readFileSync(filePath);
        // const pdfText = await pdfParse(dataBuffer);

        const filePath = path.join(resumeFolder, file);
        let resumeText = '';

        if (file.endsWith('.pdf')) {
          const dataBuffer = fs.readFileSync(filePath);
          const pdfData = await pdfParse(dataBuffer);
          resumeText = pdfData.text;
        } else if (file.endsWith('.docx')) {
          const result = await mammoth.extractRawText({ path: filePath });
          resumeText = result.value;
        } else {
          console.warn(`Unsupported file format for: ${file}`);
          continue;
        }

        const prompt = `Does this resume match the keyword "${keyword}"? Answer only YES or NO.\n\nResume Content:\n${resumeText}`;
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
  },

  async getAllResumes(ctx) {
    try {
      const resumeFolder = path.join(__dirname, '../../../../public/resumes');
      const files = fs.readdirSync(resumeFolder).filter(f => f.endsWith('.pdf') || f.endsWith('.doc') || f.endsWith('.docx'));
  
      const AllResume = files.map(file => `http://localhost:1337/resumes/${file}`);
      ctx.send({ AllResume });
    } catch (err) {
      console.error("Get all resumes error:", err);
      ctx.internalServerError("Failed to get resumes");
    }
  }

}));
