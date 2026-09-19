function validateRating(rating) {
  const n = Number(rating);
  return Number.isInteger(n) && n >= 1 && n <= 5;
}

function ensureDoctorRating(doctor) {
  if (!doctor.rating) {
    doctor.rating = { average: 0, count: 0 };
    return;
  }
  doctor.rating.average = Number(doctor.rating.average) || 0;
  doctor.rating.count   = Number(doctor.rating.count)   || 0;
}

function applyDoctorRating(doctor, newRating) {
  ensureDoctorRating(doctor);
  const oldAvg   = doctor.rating.average;
  const oldCount = doctor.rating.count;
  doctor.rating.count   = oldCount + 1;
  doctor.rating.average = parseFloat(
    (((oldAvg * oldCount) + newRating) / (oldCount + 1)).toFixed(1)
  );
}

module.exports = { validateRating, ensureDoctorRating, applyDoctorRating };
