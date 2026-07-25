package com.cotejs.api.application

import com.cotejs.api.domain.model.Problem
import com.cotejs.api.domain.model.ProblemNotFoundException
import com.cotejs.api.domain.port.inbound.ProblemQueries
import com.cotejs.api.domain.port.outbound.ProblemRepository
import org.springframework.stereotype.Service

@Service
class ProblemService(
    private val problems: ProblemRepository,
) : ProblemQueries {
    override suspend fun all(): List<Problem> = problems.findAll()

    override suspend fun byId(id: Long): Problem =
        problems.findById(id) ?: throw ProblemNotFoundException(id)
}
