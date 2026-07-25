package com.cotejs.hub.application

import com.cotejs.hub.domain.model.Problem
import com.cotejs.hub.domain.model.ProblemNotFoundException
import com.cotejs.hub.domain.port.inbound.ProblemQueries
import com.cotejs.hub.domain.port.outbound.ProblemRepository
import org.springframework.stereotype.Service

@Service
class ProblemService(
    private val problems: ProblemRepository,
) : ProblemQueries {
    override suspend fun all(): List<Problem> = problems.findAll()

    override suspend fun byId(id: Long): Problem =
        problems.findById(id) ?: throw ProblemNotFoundException(id)
}
