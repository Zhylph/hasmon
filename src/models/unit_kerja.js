module.exports = (sequelize, DataTypes) => {
  const UnitKerja = sequelize.define('UnitKerja', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nama: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    deskripsi: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'unit_kerja',
    timestamps: false
  });

  // Define associations
  UnitKerja.associate = (models) => {
    UnitKerja.hasMany(models.User, {
      foreignKey: 'unit_kerja_id'
    });
    UnitKerja.hasMany(models.SimrsUsage, {
      foreignKey: 'unit_kerja_id'
    });
  };

  return UnitKerja;
};
