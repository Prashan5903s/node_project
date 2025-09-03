const mongoose = require('mongoose')

const programSchedule = require('../../model/ProgramSchedule')
const department = require('../../model/Department')
const designation = require('../../model/Designation')
const group = require('../../model/Group')
const user = require('../../model/User')
const activity = require('../../model/Activity')
const contentFolder = require('../../model/ContentFolder')
const modules = require('../../model/Module')
const Zone = require('../../model/Zone')
const scheduleType = require('../../model/ScheduleType')
const scheduleUser = require('../../model/ScheduleUser')

const {
    successResponse,
    errorResponse
} = require('../../util/response')

exports.getProgramScheduleAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { contentFolderId } = req.params;

        const Module = await modules.findById(contentFolderId);

        if (!Module) {
            return errorResponse(res, "Module not found", {}, 404);
        }

        const ContentFolderId = Module.content_folder_id;

        const ProgramSchedule = await programSchedule.findOne({
            company_id: userId,
            content_folder_id: ContentFolderId
        }).lean();

        if (!ProgramSchedule) {
            return errorResponse(res, "Program schedule does not exist", {}, 404);
        }

        const scheduleTypes = await scheduleType.find({
            schedule_id: ProgramSchedule._id,
            company_id: userId
        }).lean();

        // 🔑 Normalize into frontend format
        const grouped = {};
        scheduleTypes.forEach(su => {
            if (!grouped[su.type]) grouped[su.type] = [];
            grouped[su.type].push(String(su.type_id));
        });

        const targetPairs = Object.entries(grouped).map(([target, options]) => ({
            target,
            options
        }));

        const finalSchedule = {
            ...ProgramSchedule,
            targetPairs
        };

        return successResponse(res, "Setting fetched successfully", finalSchedule);
    } catch (error) {
        next(error);
    }
};

exports.getCreateDataAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const finalData = {};

        const objectId = new mongoose.Types.ObjectId(userId);

        const regions = await Zone.aggregate([
            {
                $match: { created_by: objectId } // filter zones created by this user
            },
            {
                $unwind: "$region" // split region array into individual docs
            },
            {
                $replaceRoot: { newRoot: "$region" } // keep only region data
            }
        ]);

        finalData['department'] = await department.find({ created_by: userId, status: true })
        finalData['designation'] = await designation.find({ company_id: userId, status: true })
        finalData['group'] = await group.find({ company_id: userId, status: true })
        finalData['user'] = await user.find({ created_by: userId, status: true })
        finalData['region'] = regions

        return successResponse(res, "Create data fetched successfully", finalData)

    } catch (error) {
        next(error)
    }
}

exports.postProgramScheduleAPI = async (req, res, next) => {

    try {

        const {
            dueDate,
            dueDays,
            lockModule,
            pushEnrollmentSetting,
            selfEnrollmentSetting,
            targetPairs,
            dueType
        } = req.body;

        const { contentFolderId } = req.params;
        const userId = req.userId;

        // Step 1: Resolve module, contentFolder, program
        const Module = await modules.findById(contentFolderId);

        if (!Module) {
            return errorResponse(res, "Module not found", {}, 404);
        }

        const ContentFolderId = Module.content_folder_id;
        const content_folder = await contentFolder.findById(ContentFolderId);
        if (!content_folder) {
            return errorResponse(res, "Content folder not found", {}, 404);
        }

        const programId = content_folder.program_id;

        const Activity = await activity.find({ module_id: Module._id }).select("_id");
        const activityIds = Activity.map(doc => doc._id); // keep as ObjectIds

        // Create or update ProgramSchedule
        let program = await programSchedule.findOne({
            created_by: userId,
            company_id: userId,
            module_id: Module._id,
            content_folder_id: ContentFolderId,
            program_id: programId,
        });

        if (!program) {

            program = new programSchedule({
                lockModule,
                dueDate: dueType === "fixed" && dueDate ? new Date(dueDate) : null,
                dueDays: dueType === "relative" ? dueDays : null,
                pushEnrollmentSetting,
                selfEnrollmentSetting,
                dueType,
                module_id: Module._id,
                content_folder_id: ContentFolderId,
                program_id: programId,
                activity_id: activityIds,
                company_id: userId,
                created_by: userId,
                created_at: new Date(),
                updated_at: new Date()
            });

        } else {

            program.lockModule = lockModule;
            program.dueDate = dueType === "fixed" && dueDate ? new Date(dueDate) : null;
            program.dueDays = dueType === "relative" ? dueDays : null;
            program.pushEnrollmentSetting = pushEnrollmentSetting;
            program.selfEnrollmentSetting = selfEnrollmentSetting;
            program.dueType = dueType;
            program.module_id = Module._id;
            program.content_folder_id = ContentFolderId;
            program.program_id = programId;
            program.activity_id = activityIds;
            program.updated_at = new Date();

        }

        await program.save();

        // Step 3: Manage schedule_users
        await scheduleType.deleteMany({ schedule_id: program._id, company_id: userId });

        if (Array.isArray(targetPairs)) {

            const bulk = [];

            const targetUser = []

            targetPairs.forEach(pair => {

                if (pair.target && Array.isArray(pair.options)) {

                    pair.options.forEach(optionId => {

                        const type = pair.target;

                        bulk.push({
                            company_id: userId,
                            schedule_id: program._id,
                            type: type,
                            type_id: mongoose.Types.ObjectId.isValid(optionId)
                                ? new mongoose.Types.ObjectId(optionId)
                                : optionId
                        });

                    });

                }

            });

            if (bulk.length > 0) {
                await scheduleType.insertMany(bulk);
            }

            const schedule_type = await scheduleType.find({ company_id: userId, schedule_id: program._id })

            if (schedule_type && (schedule_type.length) > 0) {
                schedule_type.forEach(item => {

                    const type = item.type;
                    const typeId = item.type_id;

                    console.log("Type", type, typeId)

                    if (type == 1) {

                        // const 

                    } else if (type == 2) {

                    } else if (type == 3) {

                    } else if (type == 4) {

                    } else if (type == 5) {

                    }

                })
            }

        }

        return successResponse(res, "Settings data saved successfully");
    } catch (error) {
        console.error("Error in postProgramScheduleAPI:", error);
        next(error);
    }
};