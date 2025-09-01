const mongoose = require('mongoose')
const programSchedule = require('../../model/ProgramSchedule')
const department = require('../../model/Department')
const designation = require('../../model/Designation')
const group = require('../../model/Group')
const user = require('../../model/User')
const Zone = require('../../model/Zone')
const scheduleUser = require('../../model/ScheduleUser')

const {
    successResponse,
    errorResponse
} = require('../../util/response')

exports.getProgramScheduleAPI = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { contentFolderId } = req.params;

        const ProgramSchedule = await programSchedule.findOne({
            created_by: userId,
            company_id: userId,
            content_folder_id: contentFolderId
        }).lean();

        if (!ProgramSchedule) {
            return errorResponse(res, "Program schedule does not exist", {}, 404);
        }

        const scheduleUsers = await scheduleUser.find({
            schedule_id: ProgramSchedule._id,
            company_id: userId
        }).lean();

        // ✅ Transform correctly
        const targetPairs = [];
        const grouped = {};

        scheduleUsers.forEach((su) => {
            if (!grouped[su.type]) grouped[su.type] = [];
            grouped[su.type].push(su.type_id.toString());
        });

        Object.keys(grouped).forEach((type) => {
            targetPairs.push({
                target: type,          // "1", "2", "3", "4", "5"
                options: grouped[type] // always array
            });
        });

        ProgramSchedule.targetPairs = targetPairs;

        return successResponse(res, "Setting fetched successfully", ProgramSchedule);
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

        //Save/update ProgramSchedule
        let program = await programSchedule.findOne({
            created_by: userId,
            company_id: userId, // adjust: if you store real company_id separately
            content_folder_id: contentFolderId
        });

        if (!program) {
            program = new programSchedule({
                lockModule,
                dueDate: dueType === "fixed" ? dueDate : null,
                dueDays: dueType === "relative" ? dueDays : null,
                pushEnrollmentSetting,
                selfEnrollmentSetting,
                dueType,
                content_folder_id: contentFolderId,
                company_id: userId,
                created_by: userId
            });
        } else {
            program.lockModule = lockModule;
            program.dueDate = dueType === "fixed" ? dueDate : null;
            program.dueDays = dueType === "relative" ? dueDays : null;
            program.pushEnrollmentSetting = pushEnrollmentSetting;
            program.selfEnrollmentSetting = selfEnrollmentSetting;
            program.dueType = dueType;
            program.updated_at = new Date();
        }

        await program.save();

        // Step 2: Manage schedule_users
        await scheduleUser.deleteMany({ schedule_id: program._id });

        if (Array.isArray(targetPairs)) {
            const bulk = [];

            targetPairs.forEach(pair => {
                if (pair.target && Array.isArray(pair.options)) {
                    pair.options.forEach(optionId => {
                        bulk.push({
                            company_id: userId,  // or req.companyId if available
                            schedule_id: program._id,
                            type: pair.target,
                            type_id: optionId
                        });
                    });
                }
            });

            if (bulk.length > 0) {
                await scheduleUser.insertMany(bulk);
            }
        }

        return successResponse(res, "Settings data saved successfully");

    } catch (error) {
        next(error);
    }
};

