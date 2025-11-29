const Subject = require('../models/sequelize/Subject');
const sequelize = require('../config/database/config');

async function seedSubjects() {
  await sequelize.sync();
  const subjects = [
    {
      id: '5f1d7f3e1c9d440000a1a111',
      subjectCode: 'MATH',
      subjectName: 'Mathematics',
      gradeId: '5f1d7f3e1c9d440000a1a222',
      centerId: '5f1d7f3e1c9d440000a1a333'
    },
    {
      id: '5f1d7f3e1c9d440000a1a112',
      subjectCode: 'SCI',
      subjectName: 'Science',
      gradeId: '5f1d7f3e1c9d440000a1a222',
      centerId: '5f1d7f3e1c9d440000a1a333'
    }
  ];
  for (const subj of subjects) {
    await Subject.upsert(subj);
  }
  console.log('Subjects seeded!');
  process.exit();
}

seedSubjects().catch(err => {
  console.error('Seeding error:', err);
  process.exit(1);
});
