import { Op } from 'sequelize';
import sequelize from '../db';
import { Employee, Attendance, Excuse } from '../models';

async function performCleanup() {
  console.log('Mock malumotlarni o"chirish boshlandi...');
  await sequelize.sync();

  // "P00" orifidagi personId larga ega xodimlarni qidiramiz
  const mockEmployees = await Employee.findAll({
    where: {
      personId: {
        [Op.like]: 'P00%'
      }
    }
  });

  const ids = mockEmployees.map((e) => e.id);

  if (ids.length > 0) {
    console.log(`${ids.length} ta mock xodim topildi. O'chirilmoqda...`);

    // Avval ularning davomatlarini o'chiramiz
    const attendanceDeleted = await Attendance.destroy({
      where: {
        employeeId: {
          [Op.in]: ids
        }
      }
    });
    console.log(`${attendanceDeleted} ta mock davomat yozuvi o'chirildi.`);

    // Ularning uzrlarini ham o'chiramiz
    const excuseDeleted = await Excuse.destroy({
      where: {
        employeeId: {
          [Op.in]: ids
        }
      }
    });
    console.log(`${excuseDeleted} ta mock uzr yozuvi o'chirildi.`);

    // Endi xodimlarning o'zini o'chiramiz
    const empDeleted = await Employee.destroy({
      where: {
        id: {
          [Op.in]: ids
        }
      }
    });
    console.log(`${empDeleted} ta mock profil o'chirildi.`);
  } else {
    console.log('Hozirda bazada mock xodimlar yo"q!');
  }

  console.log('Tugatildi!');
  process.exit(0);
}

performCleanup().catch(err => {
  console.error("Xatolik yuz berdi:", err);
  process.exit(1);
});
