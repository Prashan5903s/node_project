const mongoose = require('mongoose')

const ProgramScheduleSchema = new mongoose.Schema({
    content_folder_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    company_id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    learner_points: {
        type: Number,
        required: true,
        default: 5
    },
    push_enrollement_setting: {
        type: Number,
        required: true,
        default: 3
    },
    self_enrollement_settings: {
        type: Number,
        required: true,
        default: 3
    },
    due_date_setting: {
        type: Number,
        required: true,
        default: 2
    },
    lock_module: {
        type: Boolean,
        required: true,
        default: false
    },
    fixed_due_date: {
        type: Date,
        required: true,
    },
    module_days: {
        type: Number,
        required: true,
        default: 5
    },
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    created_at: {
        type: Date,
        required: false,
        default: Date.now(),
    },
    updated_at: {
        type: Date,
        required: false,
    },
}, {
    collection: "program_schedules"
})

module.exports = mongoose.model("program_schedules", ProgramScheduleSchema)