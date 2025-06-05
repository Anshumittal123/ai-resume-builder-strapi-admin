// 'use strict';

// const fs = require('fs');
// const path = require('path');
// const pdfParse = require('pdf-parse');
// const mammoth = require('mammoth'); //
// const { AIChatSession } = require('../../../utils/AIModal.js');
// const { createCoreController } = require('@strapi/strapi').factories;

// let resumeCache = {};

// module.exports = createCoreController('api::user-resume.user-resume', ({ strapi }) => ({

//   async filterResumes(ctx) {
//       const keyword = ctx.request?.body?.keyword || '';


//     if (!keyword) {
//       return ctx.badRequest('Keyword is required');
//     }


//     try {
//       const resumeFolder = path.join(__dirname, '../../../../public/resumes');
//       const files = fs.readdirSync(resumeFolder).filter(f => f.endsWith('.pdf') || f.endsWith('.doc') || f.endsWith('.docx'));  

//       const matchedResumes = [];
//       const resumeData = [];

//       for (let file of files) {
//         const filePath = path.join(resumeFolder, file);
//         const fileStat = fs.statSync(filePath );
//         const lastModified =  fileStat.mtimeMs;
//         let resumeText = '';

//         if (resumeCache[file] && resumeCache[file].lastModified === lastModified) {
//           resumeText = resumeCache[file].text;
//         } else {

//           if (file.endsWith('.pdf')) {
//             const dataBuffer = fs.readFileSync(filePath);
//             const pdfData = await pdfParse(dataBuffer);
//             resumeText = pdfData.text;
//           } else if (file.endsWith('.docx')) {
//             const result = await mammoth.extractRawText({ path: filePath });
//             resumeText = result.value;
//           } else {
//             console.warn(`Unsupported file format for: ${file}`);
//             continue;
//           }

//           resumeCache[file] ={
//             text: resumeText,
//             lastModified
//           }

//           resumeData.push({file, resumeText});
//         }  
//       }

//       const prompt = `You are an expert recruiter. Here are ${resumeData.length} resumes. For each one, just reply with:
//       YES or NO if it matches the keyword: "${keyword}" Format: "Answer only YES or NO." give output as object {filename: , match: } \n ${resumeData.map(d => `Resume: ${d.file}\n${d.resumeText}`).join('\n\n')}.`;
//       console.log(prompt);

//       const result = await AIChatSession.sendMessage(prompt);    
//       const output = (await result.response.text()).toLowerCase();
//       console.log(`output of an ai response: ${output}`);

//       // resumeData.forEach(({ file }) => {
//       //   const lineMatch = output.includes(`${file.toLowerCase()}: yes`);
//       //   // console.log(`Match resume line: ${lineMatch}`);
//       //   // console.log(`match keywords: ${output.includes(`${file.toLowerCase()}: yes`)}`);
//       //   if (output.includes(`${file.toLowerCase()}: yes`)) {
//       //     matchedResumes.push(`http://localhost:1337/resumes/${file}`);
//       //   }
//       // });

//       resumeData.forEach(({file})=>{
//         output.forEach((el)=>{
//           if(el === 'yes'){
//             matchedResumes.push(`http://localhost:1337/resumes/${file}`);
//           }
//         })
//       })

//       ctx.send({ matchedResumes });

//     } catch (err) {
//       console.error("Resume filter error:", err);
//       ctx.internalServerError("Failed to filter resumes");
//     }
//   },

//   async getAllResumes(ctx) {
//     try {
//       const resumeFolder = path.join(__dirname, '../../../../public/resumes');
//       const files = fs.readdirSync(resumeFolder).filter(f => f.endsWith('.pdf') || f.endsWith('.doc') || f.endsWith('.docx'));
  
//       const AllResume = files.map(file => `http://localhost:1337/resumes/${file}`);
//       ctx.send({ AllResume });
//     } catch (err) {
//       console.error("Get all resumes error:", err);
//       ctx.internalServerError("Failed to get resumes");
//     }
//   }

// }));


// improve version of code for resume filter functionality 
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
        const files = fs.readdirSync(resumeFolder).filter(f => f.endsWith('.pdf') || f.endsWith('.docx'));

    
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

        const prompt = `You are an expert recruiter. I will give you a list of resumes and one keyword. You have to check if each resume matches the keyword.

        Return the result in this strict JSON format only:
        {
          "resume_files": [
            { "filename": "FILE_NAME", "match": "yes" or "no" },
            ...
          ]
        }

        Now check each resume and return JSON only:

        Keyword: "${keyword}"

        ${resumes.map(r => `Filename: ${r.file}\nResume:\n${r.text}`).join('\n\n')}
        `;

        const result = await AIChatSession.sendMessage(prompt);
        const output = await result.response.text();

        const json = JSON.parse(output);
        const matchedResumes = [];
        for (const item of json.resume_files) {
          if (item.match.toLowerCase() === 'yes') {
            matchedResumes.push(`http://localhost:1337/resumes/${item.filename}`);
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
      const files = fs.readdirSync(resumeFolder).filter(f =>
        f.endsWith('.pdf') || f.endsWith('.docx')
      );

      const AllResume = files.map(file => `http://localhost:1337/resumes/${file}`);
      ctx.send({ AllResume });
    } catch (err) {
      console.error("Get all resumes error:", err);
      ctx.internalServerError("Failed to get resumes");
    }
  }

}));