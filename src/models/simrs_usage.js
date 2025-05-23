module.exports = (sequelize, DataTypes) => {
  const SimrsUsage = sequelize.define('SimrsUsage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    unit_kerja_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: false
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'closed'),
      defaultValue: 'active'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'simrs_usage',
    timestamps: false
  });

  // Define associations
  SimrsUsage.associate = (models) => {
    SimrsUsage.belongsTo(models.User, {
      foreignKey: 'user_id'
    });
    SimrsUsage.belongsTo(models.UnitKerja, {
      foreignKey: 'unit_kerja_id'
    });
  };

  return SimrsUsage;
};
