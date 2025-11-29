module.exports = (sequelize, DataTypes) => {
	const ClassBillingTransaction = sequelize.define('ClassBillingTransaction', {
		id: {
			type: DataTypes.STRING(24),
			primaryKey: true,
			allowNull: false,
			defaultValue: () => require('crypto').randomBytes(12).toString('hex') // 24-char hex string
		},
		class_id: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		tutor_id: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		student_id: {
			type: DataTypes.INTEGER,
			allowNull: false
		},
		parent_id: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		subject: {
			type: DataTypes.STRING,
			allowNull: false
		},
		status: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: 'unpaid'
		},
		amount: {
			type: DataTypes.FLOAT,
			allowNull: false,
			defaultValue: 0
		},
		currency: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: 'USD'
		},
		scheduled_start: {
			type: DataTypes.DATE,
			allowNull: false
		},
		scheduled_end: {
			type: DataTypes.DATE,
			allowNull: true
		},
		duration_minutes: {
			type: DataTypes.INTEGER,
			allowNull: true
		},
		paymentMethod: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: null
		},
		stripePaymentId: {
			type: DataTypes.STRING,
			allowNull: true,
			unique: true,
			defaultValue: null
		},
		stripeTransactionId: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: null
		},
		paymentReference: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: null
		},
		paidDate: {
			type: DataTypes.DATE,
			allowNull: true,
			defaultValue: null
		}
	}, {
		tableName: 'classbillingtransactions',
		timestamps: false
	});

	ClassBillingTransaction.associate = (models) => {
		ClassBillingTransaction.belongsTo(models.Class, {
			foreignKey: 'class_id',
			as: 'class'
		});
		ClassBillingTransaction.belongsTo(models.User, {
			foreignKey: 'student_id',
			as: 'student'
		});
		ClassBillingTransaction.belongsTo(models.User, {
			foreignKey: 'tutor_id',
			as: 'tutor'
		});
		ClassBillingTransaction.belongsTo(models.User, {
			foreignKey: 'parent_id',
			as: 'parent'
		});
	};

	return ClassBillingTransaction;
};
