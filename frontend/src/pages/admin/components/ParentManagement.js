import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../../../shared/components/LoadingSpinner';
import ParentModal from './ParentModal';
import { userAPI, parentsAPI } from '../../../utils/api';
import { getErrorMessage } from '../../../utils/helpers';
import styles from './ParentManagement.module.css';

const ParentManagement = ({ onRefresh }) => {
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(true);
  const isInitialized = useRef(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedParent, setSelectedParent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      loadParents();
    }
  }, []);

  const loadParents = async () => {
    try {
      setLoading(true);
      const response = await parentsAPI.getParents();
      setParents(response.data?.data?.parents || []); // Backend returns parents in data.data.parents
      setError(null);
    } catch (err) {
      console.error('Error loading parents:', err);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAddParent = () => {
    setSelectedParent(null);
    setShowModal(true);
  };

  const handleEditParent = (parent) => {
    setSelectedParent(parent);
    setShowModal(true);
  };

  const handleDeleteParent = async (parentId) => {
    if (!window.confirm('Are you sure you want to delete this parent? This action cannot be undone.')) {
      return;
    }

    try {
      await parentsAPI.deleteParent(parentId);
      await loadParents();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Error deleting parent:', err);
      alert('Error deleting parent: ' + getErrorMessage(err));
    }
  };

  const handleModalClose = async (saved) => {
    setShowModal(false);
    setSelectedParent(null);
    if (saved) {
      await loadParents();
      if (onRefresh) onRefresh();
    }
  };

  const handleSaveParent = async (parentData) => {
    try {
      if (selectedParent) {
        await parentsAPI.updateParent(selectedParent.id, parentData);
      } else {
        await parentsAPI.createParent(parentData);
      }
      await loadParents();
      setShowModal(false);
      setSelectedParent(null);
    } catch (err) {
      console.error('Error saving parent:', err);
      alert('Error saving parent: ' + getErrorMessage(err));
    }
  };


  // Pagination logic (match Student Management)
  const [currentPage, setCurrentPage] = useState(1);
  const parentsPerPage = 5;
  const filteredParents = parents.filter(parent => {
    const fullName = `${parent.first_name || ''} ${parent.last_name || ''}`.trim();
    return fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parent.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      parent.username?.toLowerCase().includes(searchTerm.toLowerCase());
  });
  const indexOfLastParent = currentPage * parentsPerPage;
  const indexOfFirstParent = indexOfLastParent - parentsPerPage;
  const currentParents = filteredParents.slice(indexOfFirstParent, indexOfLastParent);
  const totalPages = Math.ceil(filteredParents.length / parentsPerPage);

  if (loading) {
    return <LoadingSpinner message="Loading parents..." />;
  }

  return (
    <div className={styles.parentManagement}>
      <div className={styles.header}>
        <h2>👨‍👩‍👧‍👦 Parent Management</h2>
        <div className={styles.headerActions}>
          <span className={styles.resultsCount}>
            {filteredParents.length} parents found
          </span>
          <button 
            className="btn btn-primary"
            onClick={handleAddParent}
          >
            <i className="fas fa-plus mr-2"></i>
            Add Parent
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
          <button 
            className="btn btn-sm btn-outline-danger ml-2"
            onClick={loadParents}
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search parents by name, email, or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filterGroup}>
          <select 
            className={styles.filterSelect}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {filteredParents.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>👨‍👩‍👧‍👦</div>
          <h3>No Parents Found</h3>
          <p>
            {searchTerm 
              ? 'No parents match your search criteria.' 
              : 'No parents have been added yet. Create your first parent account to get started.'
            }
          </p>
          {!searchTerm && (
            <button 
              className="btn btn-primary"
              onClick={handleAddParent}
            >
              ➕ Add First Parent
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.parentTable}>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      // checked={selectedParents.length === filteredParents.length && filteredParents.length > 0}
                      // onChange={handleSelectAll}
                    />
                  </th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Phone</th>
                  <th>Children</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Last Login</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentParents.map((parent) => (
                  <tr key={parent._id}>
                  <td>
                    <input
                      type="checkbox"
                      // checked={selectedParents.includes(parent._id)}
                      // onChange={() => handleSelectParent(parent._id)}
                    />
                  </td>
                  <td>
                    <div className={styles.parentName}>
                      <span className={styles.name}>
                        {`${parent.first_name || ''} ${parent.last_name || ''}`}
                      </span>
                      <span className={styles.username}>@{parent.username}</span>
                    </div>
                  </td>
                  <td>{parent.email}</td>
                  <td>{parent.username}</td>
                  <td>{parent.phone_number || parent.phoneNumber || 'Not provided'}</td>
                  <td>
                    <span className={styles.childrenCount}>
                      {parent.assignments?.children?.length || 0}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${parent.isActive !== false ? styles.badgeSuccess : styles.badgeDanger}`}>
                      {parent.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {parent.createdAt ? new Date(parent.createdAt).toLocaleDateString() : 'Unknown'}
                  </td>
                  <td>
                    {parent.lastLogin 
                      ? new Date(parent.lastLogin).toLocaleDateString()
                      : 'Never'
                    }
                  </td>
                  <td>
                    <div className={styles.actionButtons}>
                      <button
                        className="btn btn-sm btn-outline-primary me-1"
                        onClick={() => handleEditParent(parent)}
                        title="Edit Parent"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDeleteParent(parent.id)}
                        title="Delete Parent"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
            {/* Pagination (Student style, centered info, right-aligned buttons) */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={styles.paginationBtn}
                  >
                    Previous
                  </button>
                </div>
                <div className={styles.paginationInfo} style={{ flex: 1, textAlign: 'center' }}>
                  Page {currentPage} of {totalPages} ({filteredParents.length} parents)
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={styles.paginationBtn}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showModal && (
        <ParentModal
          parent={selectedParent}
          onClose={handleModalClose}
          onSave={handleSaveParent}
        />
      )}
    </div>
  );
};

export default ParentManagement;
