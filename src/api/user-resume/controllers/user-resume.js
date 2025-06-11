'use strict';

const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const axios = require('axios');
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

    const cacheKey = `match-${keyword}`;
    if (matchMemory.has(cacheKey)) {
      return ctx.send({ matchedResumes: matchMemory.get(cacheKey) });
    }

    try {
      // Fetch resumes from Strapi DB
      const resumes = await strapi.entityService.findMany("api::career-detail.career-detail", {
        populate: { resume: true },
      });

      const resumeData = [];
      const matchedResumes = [];
      console.log(`resumes from backend: ${resumes}`);
      resumes.forEach((detail)=>{
        console.log(`resume first name: ${detail.firstName}`);
      })
      // Download and extract resume text
      for (const resume of resumes) {
        // const fileInfo = resume.resume;
        // if (!fileInfo || !fileInfo.url) continue;
        const fileInfo = Array.isArray(resume.resume) ? resume.resume[0] : resume.resume;
        if (!fileInfo || !fileInfo.url) continue;

        console.log(`Resume info Details: ${fileInfo}`);

        const fileUrl = `http://localhost:1337${fileInfo.url}`;
        const fileName = fileInfo.name;
        const ext = fileInfo.ext;

        console.log(`Resume url: ${fileUrl}`);
        console.log(`Resume extension: ${ext}`);
        console.log(`Resume file name: ${fileName}`);


        try{
          let resumeText = '';

          if (ext === '.pdf') {
            try {
              const response = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
                headers: {
                  Accept: 'application/pdf',
                },
              });
              const dataBuffer = Buffer.from(response.data, 'binary');
              const pdfData = await pdfParse(dataBuffer);
              // console.log(`pdf data of Resume: ${pdfData}`);
              resumeText = pdfData.text;
              // console.log(`Resume Text of Pdf type: ${resumeText}`);
            } catch (err) {
              console.error(`Failed to download or parse PDF: ${fileUrl}`, err.message);
              continue;
            }
          } else if (ext === '.docx') {
            const tempPath = path.join(__dirname, `${fileName}`);
            console.log(`temp path of docx: ${tempPath}`);
            fs.writeFileSync(tempPath, dataBuffer);
            const result = await mammoth.extractRawText({ path: tempPath });
            // console.log(`Docx Resume Data: ${result}`);
            resumeText = result.value;
            console.log(`Resume Text of Docx type: ${resumeText}`);
            fs.unlinkSync(tempPath);
          } else {
            continue;
          }


          const cleanText = resumeText.replace(/\s+/g, ' ').trim().split(' ').slice(0, 1000).join(' ');
          resumeData.push({ file: fileName, resumeText: cleanText, fullUrl: fileUrl });

        }catch(err){
          console.error("Failed to download:", fileUrl);
          continue;
        }
      }

      // Batch AI filter
      const batchSize = 5;
      for (let i = 0; i < resumeData.length; i += batchSize) {
        const chunk = resumeData.slice(i, i + batchSize);
        const prompt = `You are an expert recruiter. For each of the following resumes, just return a JSON array of objects like this: [{"filename": "resume-name.pdf", "match": "yes"}, ...] depending on if it matches this keyword: "${keyword}"\n\n${chunk.map(d => `Resume: ${d.file}\n${d.resumeText}`).join('\n\n')}`;

        const result = await AIChatSession.sendMessage(prompt);
        // console.log(`result of ai: ${result}`);
        const outputText = await result.response.text();
        // console.log("AI response output:", outputText);
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
            // matchMemory.set(fullKey, match);

            const matchedFile = resumeData.find(r => r.file.toLowerCase().includes(file.toLowerCase()));
            if (match === 'yes' && matchedFile) {
              console.log(`Matched Resume: ${matchedFile.fullUrl}`);
              matchedResumes.push(matchedFile.fullUrl);
            }
          });
        }
      }

      matchMemory.set(cacheKey, matchedResumes);
      ctx.send({ matchedResumes });

    } catch (err) {
      console.error("Resume filter error:", err);
      ctx.internalServerError("Failed to filter resumes");
    }
  },

  async getAllResumes(ctx) {
    try {
      const resumes = await strapi.entityService.findMany("api::user-resume.user-resume", {
        populate: { resume: true },
      });

      const AllResume = resumes.map(r => `http://localhost:1337${r.resume?.url || ''}`);
      ctx.send({ AllResume });
    } catch (err) {
      console.error("Get all resumes error:", err);
      ctx.internalServerError("Failed to get resumes");
    }
  }

}));


// 'use strict';

// const fs = require('fs');
// const path = require('path');
// const pdfParse = require('pdf-parse');
// const mammoth = require('mammoth');
// const axios = require('axios');
// const { AIChatSession } = require('../../../utils/AIModal.js');
// const { createCoreController } = require('@strapi/strapi').factories;

// const resumeCache = {};
// const matchMemory = new Map();

// module.exports = createCoreController('api::user-resume.user-resume', ({ strapi }) => ({

//   async filterResumes(ctx) {
//     const keyword = ctx.request?.body?.keyword?.trim().toLowerCase() || '';

//     if (!keyword) {
//       return ctx.badRequest('Keyword is required');
//     }

//     const cacheKey = `match-${keyword}`;
//     if (matchMemory.has(cacheKey)) {
//       return ctx.send({ matchedResumes: matchMemory.get(cacheKey) });
//     }

//     try {
//       const resumes = await strapi.entityService.findMany("api::career-detail.career-detail", {
//         populate: { resume: true },
//       });

//       const resumeData = [];
//       const matchedResumes = [];

//       for (const resume of resumes) {
//         const fileInfo = Array.isArray(resume.resume) ? resume.resume[0] : resume.resume;
//         if (!fileInfo || !fileInfo.url) continue;

//         const fileUrl = `http://localhost:1337${fileInfo.url}`;
//         const fileName = fileInfo.name;
//         const ext = fileInfo.ext;

//         try {
//           let resumeText = '';

//           if (ext === '.pdf') {
//             const response = await axios.get(fileUrl, {
//               responseType: 'arraybuffer',
//               headers: {
//                 Accept: 'application/pdf',
//               },
//             });
//             const dataBuffer = Buffer.from(response.data, 'binary');
//             const pdfData = await pdfParse(dataBuffer);
//             resumeText = pdfData.text;
//           } else if (ext === '.docx') {
//             const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
//             const dataBuffer = Buffer.from(response.data, 'binary');
//             const tempPath = path.join(__dirname, fileName);
//             fs.writeFileSync(tempPath, dataBuffer);
//             const result = await mammoth.extractRawText({ path: tempPath });
//             resumeText = result.value;
//             fs.unlinkSync(tempPath);
//           } else {
//             continue;
//           }

//           const cleanText = resumeText.replace(/\s+/g, ' ').trim().split(' ').slice(0, 1000).join(' ');
//           resumeData.push({ file: fileName, resumeText: cleanText, fullUrl: fileUrl });

//         } catch (err) {
//           console.error("Failed to download or parse resume:", fileUrl);
//           continue;
//         }
//       }

//       const batchSize = 5;
//       for (let i = 0; i < resumeData.length; i += batchSize) {
//         const chunk = resumeData.slice(i, i + batchSize);
//         const prompt = `You are an expert recruiter. For each of the following resumes, just return a JSON array of objects like this: [{"filename": "resume-name.pdf", "match": "yes"}, ...] depending on if it matches this keyword: "${keyword}"

// ${chunk.map(d => `Resume: ${d.file}\n${d.resumeText}`).join('\n\n')}`;

//         const result = await AIChatSession.sendMessage(prompt);
//         const outputText = await result.response.text();
//         let json = {};

//         try {
//           json = JSON.parse(outputText.trim());
//         } catch (err) {
//           console.error("Failed to parse AI output:", outputText);
//           continue;
//         }

//         if (Array.isArray(json)) {
//           json.forEach(item => {
//             const file = item.filename;
//             const match = item.match?.toLowerCase();
//             const matchedFile = resumeData.find(r => r.file.toLowerCase().includes(file.toLowerCase()));
//             if (match === 'yes' && matchedFile) {
//               matchedResumes.push(matchedFile.fullUrl);
//             }
//           });
//         }
//       }

//       matchMemory.set(cacheKey, matchedResumes);
//       ctx.send({ matchedResumes });

//     } catch (err) {
//       console.error("Resume filter error:", err);
//       ctx.internalServerError("Failed to filter resumes");
//     }
//   },

//   async getAllResumes(ctx) {
//     try {
//       const resumes = await strapi.entityService.findMany("api::user-resume.user-resume", {
//         populate: { resume: true },
//       });

//       const AllResume = resumes.map(r => `http://localhost:1337${r.resume?.url || ''}`);
//       ctx.send({ AllResume });
//     } catch (err) {
//       console.error("Get all resumes error:", err);
//       ctx.internalServerError("Failed to get resumes");
//     }
//   }

// }));
