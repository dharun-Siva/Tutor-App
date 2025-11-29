import React from 'react';

function SubjectDropdown({ value, onChange, subjects = [], loading = false }) {
  return (
    <select value={value} onChange={onChange} required>
      <option value="">Select subject</option>
      {loading ? (
        <option disabled>Loading...</option>
      ) : (
        subjects.map(subj => (
          <option key={subj._id || subj.id} value={subj._id || subj.id}>
            {subj.subjectName} ({subj.subjectCode})
          </option>
        ))
      )}
    </select>
  );
}

export default SubjectDropdown;
