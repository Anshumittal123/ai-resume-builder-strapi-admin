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
//     const keyword = ctx.request?.body?.keyword || '';
//     if (!keyword) return ctx.badRequest('Keyword is required');

//     try {
//       const resumeFolder = path.join(__dirname, '../../../../public/resumes');
//       const files = fs.readdirSync(resumeFolder)
//         .filter(f => f.endsWith('.pdf') || f.endsWith('.docx'));

//       const resumes = await Promise.all(files.map(async (file) => {
//         const filePath = path.join(resumeFolder, file);
//         const stat = await fs.promises.stat(filePath);
//         const lastModified = stat.mtimeMs;

//         if (resumeCache[file] && resumeCache[file].lastModified === lastModified) {
//           return { file, text: resumeCache[file].text };
//         }

//         let text = '';
//         if (file.endsWith('.pdf')) {
//           const dataBuffer = await fs.promises.readFile(filePath);
//           const pdfData = await pdfParse(dataBuffer);
//           text = pdfData.text;
//         } else if (file.endsWith('.docx')) {
//           const result = await mammoth.extractRawText({ path: filePath });
//           text = result.value;
//         }

//         resumeCache[file] = { text, lastModified };
//         return { file, text };
//       }));

//       const prompt = `You are an expert recruiter. Your task is to match each resume with the keyword.
//       Return only a JSON object in this format:
//       {
//         "resume_files": [
//           { "filename": "FILE_NAME", "match": "yes" or "no" }
//         ]
//       }
//       Keyword: "${keyword}"
//       Now match each resume:
//       ${resumes.map(r => `Filename: ${r.file}\nResume:\n${r.text}`).join('\n\n')}
//       `;

//       const result = await AIChatSession.sendMessage(prompt);
//       const output = await result.response.text();

//       let matchedResumes = [];

//       try {
//         const json = JSON.parse(output);
//         if (json?.resume_files) {
//           matchedResumes = json.resume_files
//             .filter(item => item.match?.toLowerCase() === 'yes')
//             .map(item => `http://localhost:1337/resumes/${item.filename}`);
//         }
//       } catch (err) {
//         console.error("Failed to parse AI JSON:", err);
//       }

//       ctx.send({ matchedResumes });

//     } catch (err) {
//       console.error("Resume filter error:", err);
//       ctx.internalServerError("Failed to filter resumes");
//     }
//   },

//   async getAllResumes(ctx) {
//     try {
//       const resumeFolder = path.join(__dirname, '../../../../public/resumes');
//       const files = fs.readdirSync(resumeFolder)
//         .filter(f => f.endsWith('.pdf') || f.endsWith('.docx'));
//       const AllResume = files.map(file => `http://localhost:1337/resumes/${file}`);
//       ctx.send({ AllResume });
//     } catch (err) {
//       console.error("Get all resumes error:", err);
//       ctx.internalServerError("Failed to get resumes");
//     }
//   }

// }));


// 3 time improver version of code for resume filter functionality 

'use strict';

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { AIChatSession } = require('../../../utils/AIModal.js');
const { createCoreController } = require('@strapi/strapi').factories;

const resumeCache = {}; 
const matchMemory = new Map(); 

module.exports = createCoreController('api::user-resume.user-resume', ({ strapi }) => ({

  async filterResumes(ctx) {
    const keyword = ctx.request?.body?.keyword?.trim().toLowerCase() || '';

    if (!keyword) {
      return ctx.badRequest('Keyword is required');
    }

    try {
      const resumeFolder = path.join(__dirname, '../../../../public/resumes');
      const files = fs.readdirSync(resumeFolder).filter(f => f.endsWith('.pdf') || f.endsWith('.docx'));

      const resumeData = [];
      const matchedResumes = [];

      for (let file of files) {
        const filePath = path.join(resumeFolder, file);
        const fileStat = fs.statSync(filePath);
        const lastModified = fileStat.mtimeMs;
        const key = `${file.toLowerCase()}-${keyword}`;

        if (matchMemory.has(key)) {
          if (matchMemory.get(key) === 'yes') {
            matchedResumes.push(`http://localhost:1337/resumes/${file}`);
          }
          continue; 
        }

        let resumeText = '';
        if (resumeCache[file] && resumeCache[file].lastModified === lastModified) {
          resumeText = resumeCache[file].text;
        } else {
          if (file.endsWith('.pdf')) {
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            resumeText = pdfData.text;
          } else if (file.endsWith('.docx')) {
            const result = await mammoth.extractRawText({ path: filePath });
            resumeText = result.value;
          } else {
            continue;
          }
          resumeCache[file] = { text: resumeText, lastModified };
        }

        const cleanText = resumeText.replace(/\s+/g, ' ').trim().split(' ').slice(0, 1000).join(' ');
        resumeData.push({ file, resumeText: cleanText });
      }

      const batchSize = 5;
      for (let i = 0; i < resumeData.length; i += batchSize) {
        const chunk = resumeData.slice(i, i + batchSize);

        const prompt = `You are an expert recruiter. For each of the following resumes, just return a JSON array of objects like this: [{"filename": "resume-name.pdf", "match": "yes"}, ...] depending on if it matches this keyword: "${keyword}"\n\n${chunk.map(d => `Resume: ${d.file}\n${d.resumeText}`).join('\n\n')}`;

        const result = await AIChatSession.sendMessage(prompt);
        const outputText = await result.response.text();
        let json = {};

        try {
          json = JSON.parse(outputText.trim());
        } catch (err) {
          console.error("Failed to parse AI output:", outputText);
          continue;
        }

        if (Array.isArray(json)) {
          json.forEach(item => {
            const file = item.filename;
            const match = item.match?.toLowerCase();
            const fullKey = `${file.toLowerCase()}-${keyword}`;
            matchMemory.set(fullKey, match);

            if (match === 'yes') {
              matchedResumes.push(`http://localhost:1337/resumes/${file}`);
            }
          });
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
      const files = fs.readdirSync(resumeFolder).filter(f => f.endsWith('.pdf') || f.endsWith('.docx'));

      const AllResume = files.map(file => `http://localhost:1337/resumes/${file}`);
      ctx.send({ AllResume });
    } catch (err) {
      console.error("Get all resumes error:", err);
      ctx.internalServerError("Failed to get resumes");
    }
  }

}));

