const programSchedule = require('../../model/ProgramSchedule')
const department = require('../../model/Department')
const designation = require('../../model/Designation')
const group = require('../../model/Group')
const user = require('../../model/User')
const Zone = require('../../model/Zone')
const mongoose = require('mongoose')
const { successResponse, errorResponse } = require('../../util/response')

exports.getProgramScheduleAPI = async (req, res, next) => {
    try {

        const userId = req.userId;

        const { contentFolderId } = req.params;

        const ProgramSchedule = await programSchedule.findOne({ created_by: userId, company_id: userId, content_folder_id: contentFolderId })

        if (!ProgramSchedule) {
            return errorResponse(res, "Program schedule does not exist", {}, 404)
        }

        return successResponse(res, "Setting fetched successfully", ProgramSchedule)

    } catch (error) {
        next(error)
    }
}

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

        const ProgramSchedule = await programSchedule.findOne({ created_by: userId, company_id: userId, content_folder_id: contentFolderId })

        if (!ProgramSchedule) {

            // Validation: Ensure correct field is present based on dueType
            if (dueType === "fixed" && !dueDate) {
                return res.status(400).json({ status: "Failure", message: "dueDate is required for fixed dueType" });
            }
            if (dueType === "relative" && !dueDays) {
                return res.status(400).json({ status: "Failure", message: "dueDays is required for relative dueType" });
            }

            const ProgramSchedule = new programSchedule({
                lockModule,
                dueDate: dueType === "fixed" ? dueDate : null,
                dueDays: dueType === "relative" ? dueDays : null,
                pushEnrollmentSetting,
                selfEnrollmentSetting,
                targetPairs: targetPairs && targetPairs.length ? targetPairs : [],
                dueType,
                content_folder_id: contentFolderId,
                company_id: userId,
                created_by: userId
            });

            await ProgramSchedule.save();

        } else {

            if (dueType === "fixed" && !dueDate) {
                return res.status(400).json({ status: "Failure", message: "dueDate is required for fixed dueType" });
            }
            if (dueType === "relative" && !dueDays) {
                return res.status(400).json({ status: "Failure", message: "dueDays is required for relative dueType" });
            }

            await programSchedule.findOneAndUpdate({ created_by: userId, company_id: userId, content_folder_id: contentFolderId }, {
                lockModule,
                dueDate: dueType === "fixed" ? dueDate : null,
                dueDays: dueType === "relative" ? dueDays : null,
                pushEnrollmentSetting,
                selfEnrollmentSetting,
                targetPairs: targetPairs && targetPairs.length ? targetPairs : [],
                dueType,
                content_folder_id: contentFolderId,
                company_id: userId,
                created_by: userId
            })
        }

        return successResponse(res, "Settings data saved successfully");
    } catch (error) {
        next(error);
    }
};

