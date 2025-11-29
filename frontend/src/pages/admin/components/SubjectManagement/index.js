import React, { useState } from 'react';
import GradeTab from './GradeTab';
import SubjectTab from './SubjectTab';
import TopicTab from './TopicTab';
import SubtopicTab from './SubtopicTab';
import HomeworkTab from './HomeworkTab';
import AssignmentsTab from './AssignmentsTab';
import styles from './SubjectManagement.module.css';

const SubjectManagement = () => {
  const [activeSubTab, setActiveSubTab] = useState('grades');

  return (
    <div className={styles.subjectManagement}>
      {/* Sub-tab Navigation */}
      <div className={styles.subTabs}>
        <button 
          className={`${styles.subTabButton} ${activeSubTab === 'grades' ? styles.active : ''}`}
          onClick={() => setActiveSubTab('grades')}
        >
          Grade
        </button>
        <button 
          className={`${styles.subTabButton} ${activeSubTab === 'subjects' ? styles.active : ''}`}
          onClick={() => setActiveSubTab('subjects')}
        >
          Subject
        </button>
        <button 
          className={`${styles.subTabButton} ${activeSubTab === 'topics' ? styles.active : ''}`}
          onClick={() => setActiveSubTab('topics')}
        >
          Topic
        </button>
        <button 
          className={`${styles.subTabButton} ${activeSubTab === 'subtopics' ? styles.active : ''}`}
          onClick={() => setActiveSubTab('subtopics')}
        >
          Sub-topic
        </button>
        <button 
          className={`${styles.subTabButton} ${activeSubTab === 'homework' ? styles.active : ''}`}
          onClick={() => setActiveSubTab('homework')}
        >
          Homework
        </button>
        <button 
          className={`${styles.subTabButton} ${activeSubTab === 'assignments' ? styles.active : ''}`}
          onClick={() => setActiveSubTab('assignments')}
        >
          Assignments
        </button>
      </div>

      {/* Sub-tab Content */}
      <div className={styles.subTabContent}>
        {activeSubTab === 'grades' && <GradeTab />}
        {activeSubTab === 'subjects' && <SubjectTab />}
        {activeSubTab === 'topics' && <TopicTab />}
        {activeSubTab === 'subtopics' && <SubtopicTab />}
        {activeSubTab === 'homework' && <HomeworkTab />}
        {activeSubTab === 'assignments' && <AssignmentsTab />}
      </div>
    </div>
  );
};

export default SubjectManagement;