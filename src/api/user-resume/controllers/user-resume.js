// 'use strict';

// const fs = require('fs');
// const path = require('path');
// const pdfParse = require('pdf-parse');
// const mammoth = require('mammoth');
// const { AIChatSession } = require('../../../utils/AIModal.js');
// const { createCoreController } = require('@strapi/strapi').factories;

// let resumeCache = {};

// module.exports = createCoreController('api::user-resume.user-resume', ({ strapi }) => ({

//   async filterResumes(ctx) {
//       const keyword = ctx.request?.body?.keyword || '';
//       if (!keyword) return ctx.badRequest('Keyword is required');

//       try {
//         const resumeFolder = path.join(__dirname, '../../../../public/resumes');
//         const files = fs.readdirSync(resumeFolder).filter(f => f.endsWith('.pdf') || f.endsWith('.docx'));

    
//         const resumes = await Promise.all(files.map(async (file) => {
//           const filePath = path.join(resumeFolder, file);
//           const stat = await fs.promises.stat(filePath);
//           const lastModified = stat.mtimeMs;

//           if (resumeCache[file] && resumeCache[file].lastModified === lastModified) {
//             return { file, text: resumeCache[file].text };
//           }

//           let text = '';
//           if (file.endsWith('.pdf')) {
//             const dataBuffer = await fs.promises.readFile(filePath);
//             const pdfData = await pdfParse(dataBuffer);
//             text = pdfData.text;
//           } else if (file.endsWith('.docx')) {
//             const result = await mammoth.extractRawText({ path: filePath });
//             text = result.value;
//           }

//           resumeCache[file] = { text, lastModified };
//           return { file, text };
//         }));

//         const prompt = `You are an expert recruiter. I will give you a list of resumes and one keyword. You have to check if each resume matches the keyword.

//         Return the result in this strict JSON format only:
//         {
//           "resume_files": [
//             { "filename": "FILE_NAME", "match": "yes" or "no" },
//             ...
//           ]
//         }

//         Now check each resume and return JSON only:

//         Keyword: "${keyword}"

//         ${resumes.map(r => `Filename: ${r.file}\nResume:\n${r.text}`).join('\n\n')}
//         `;

//         const result = await AIChatSession.sendMessage(prompt);
//         const output = await result.response.text();

//         const json = JSON.parse(output);
//         const matchedResumes = [];
//         for (const item of json.resume_files) {
//           if (item.match.toLowerCase() === 'yes') {
//             matchedResumes.push(`http://localhost:1337/resumes/${item.filename}`);
//           }
//         }

//         ctx.send({ matchedResumes });
//       } catch (err) {
//         console.error("Resume filter error:", err);
//         ctx.internalServerError("Failed to filter resumes");
//       }
//     },

//   async getAllResumes(ctx) {
//     try {
//       const resumeFolder = path.join(__dirname, '../../../../public/resumes');
//       const files = fs.readdirSync(resumeFolder).filter(f =>
//         f.endsWith('.pdf') || f.endsWith('.docx')
//       );

//       const AllResume = files.map(file => `http://localhost:1337/resumes/${file}`);
//       ctx.send({ AllResume });
//     } catch (err) {
//       console.error("Get all resumes error:", err);
//       ctx.internalServerError("Failed to get resumes");
//     }
//   }

// }));


// improve version of codes for resume filter functionality 

'use strict';

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { AIChatSession } = require('../../../utils/AIModal.js');
const { createCoreController } = require('@strapi/strapi').factories;

let resumeCache = {};

module.exports = createCoreController('api::user-resume.user-resume', ({ strapi }) => ({

  async filterResumes(ctx) {
    const keyword = ctx.request?.body?.keyword || '';
    if (!keyword) return ctx.badRequest('Keyword is required');

    try {
      const resumeFolder = path.join(__dirname, '../../../../public/resumes');
      const files = fs.readdirSync(resumeFolder)
        .filter(f => f.endsWith('.pdf') || f.endsWith('.docx'));

      const resumes = await Promise.all(files.map(async (file) => {
        const filePath = path.join(resumeFolder, file);
        const stat = await fs.promises.stat(filePath);
        const lastModified = stat.mtimeMs;

        if (resumeCache[file] && resumeCache[file].lastModified === lastModified) {
          return { file, text: resumeCache[file].text };
        }

        let text = '';
        if (file.endsWith('.pdf')) {
          const dataBuffer = await fs.promises.readFile(filePath);
          const pdfData = await pdfParse(dataBuffer);
          text = pdfData.text;
        } else if (file.endsWith('.docx')) {
          const result = await mammoth.extractRawText({ path: filePath });
          text = result.value;
        }

        resumeCache[file] = { text, lastModified };
        return { file, text };
      }));

      const prompt = `You are an expert recruiter. Your task is to match each resume with the keyword.
      Return only a JSON object in this format:
      {
        "resume_files": [
          { "filename": "FILE_NAME", "match": "yes" or "no" }
        ]
      }
      Keyword: "${keyword}"
      Now match each resume:
      ${resumes.map(r => `Filename: ${r.file}\nResume:\n${r.text}`).join('\n\n')}
      `;

      const result = await AIChatSession.sendMessage(prompt);
      const output = await result.response.text();

      let matchedResumes = [];

      try {
        const json = JSON.parse(output);
        if (json?.resume_files) {
          matchedResumes = json.resume_files
            .filter(item => item.match?.toLowerCase() === 'yes')
            .map(item => `http://localhost:1337/resumes/${item.filename}`);
        }
      } catch (err) {
        console.error("Failed to parse AI JSON:", err);
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
      const files = fs.readdirSync(resumeFolder)
        .filter(f => f.endsWith('.pdf') || f.endsWith('.docx'));
      const AllResume = files.map(file => `http://localhost:1337/resumes/${file}`);
      ctx.send({ AllResume });
    } catch (err) {
      console.error("Get all resumes error:", err);
      ctx.internalServerError("Failed to get resumes");
    }
  }

}));
